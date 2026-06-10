// Storage abstraction for partner-uploaded menu images.
//
// Two backends, env-detected at module load:
//
//   1. CLOUDINARY  — used when CLOUDINARY_URL is set (e.g. on Railway prod).
//                    cloudinary://api_key:api_secret@cloud_name
//                    Images live in the Cloudinary folder "quickrons/menu/<partnerId>".
//
//   2. LOCAL DISK  — fallback for local dev. Writes to backend/uploads/menu/<partnerId>/.
//                    Express serves /uploads as a static folder (see src/index.js).
//                    NOTE: Railway's filesystem is ephemeral — local-disk uploads will
//                    disappear on redeploy. Cloudinary (or S3) is required for prod.
//
// Both backends accept a Buffer + original filename + mime type and return:
//   { url, provider, sizeBytes, mimeType }
//
// The module also exports a multer middleware (`uploadMw`) that parses a single
// multipart field named "file" into req.file (in-memory). Routes that want the
// upload simply do: router.post('/upload', uploadMw, asyncH(handler))

'use strict';

const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_BYTES = 10 * 1024 * 1024;                  // 10 MB — clients resize first,
                                                     // this is the safety ceiling for
                                                     // large phone-camera originals.
const ALLOWED   = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const MENU_SUBDIR = 'menu';

// ─── Optional deps — load defensively ────────────────────────────────────────
// `multer` and `cloudinary` are required at run-time only when a request hits.
// The module imports them up-front but tolerates absence (e.g. fresh checkout
// before `npm install`) so the rest of the server still boots.

let multer;
try { multer = require('multer'); } catch (_) { /* npm i multer */ }

let cloudinary;
try { cloudinary = require('cloudinary').v2; } catch (_) { /* npm i cloudinary */ }

// Detect Cloudinary configuration. CLOUDINARY_URL is the canonical form;
// individual CLOUDINARY_* vars are also accepted as a courtesy.
const HAS_CLOUDINARY =
  !!cloudinary && (
    !!process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );

if (HAS_CLOUDINARY) {
  if (process.env.CLOUDINARY_URL) {
    // Cloudinary picks this up automatically from env, but we call config()
    // so subsequent uploads work even if dotenv parses lazily.
    cloudinary.config({ secure: true });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure:     true,
    });
  }
  console.log('[upload] storage=cloudinary');
} else {
  // Ensure the local uploads root exists. Creating recursively is idempotent.
  try { fs.mkdirSync(UPLOAD_ROOT, { recursive: true }); } catch (_) {}
  console.log(`[upload] storage=local  root=${UPLOAD_ROOT}`);
}

// ─── Multer middleware — in-memory parse + size + type guards ────────────────
//
// Routes use this directly: router.post('/upload', uploadMw, handler).
// If multer isn't installed yet, exports a stub that returns a clear 500 so
// the deploy log obviously points at the missing dep instead of a cryptic crash.

const rawUpload = multer
  ? multer({
      storage: multer.memoryStorage(),
      limits:  { fileSize: MAX_BYTES, files: 1 },
      fileFilter (_req, file, cb) {
        if (!ALLOWED.has(file.mimetype)) {
          return cb(new Error(`Unsupported file type: ${file.mimetype}. Use JPG, PNG, or WebP.`));
        }
        cb(null, true);
      },
    }).single('file')
  : null;

// Wrap multer so its rejections (unsupported type, file too large) become clear
// 400s instead of bubbling to the central handler as opaque 500s. Dangerous /
// non-image files are rejected here before any disk or Cloudinary write.
function uploadMw (req, res, next) {
  if (!rawUpload) {
    return res.status(500).json({
      error: { code: 'UPLOAD_NOT_CONFIGURED', message: 'Image upload is not configured — run: npm i multer cloudinary' },
    });
  }
  rawUpload(req, res, (err) => {
    if (!err) return next();
    let message = err.message || 'Upload rejected';
    if (multer && err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      message = `Image too large — max ${Math.round(MAX_BYTES / (1024 * 1024))} MB.`;
    }
    return res.status(400).json({ error: { code: 'UPLOAD_REJECTED', message } });
  });
}

// ─── Storage drivers ─────────────────────────────────────────────────────────

async function storeOnCloudinary ({ buffer, mimeType, ownerId }) {
  // Cloudinary's upload_stream takes a callback. Wrap it in a Promise.
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:        `quickrons/menu/${ownerId}`,
        resource_type: 'image',
        // Cloudinary will infer the format from the upload, but pin it for safety.
        format:        EXT_BY_MIME[mimeType] || undefined,
        // Reasonable transformations baked in — partners can paste this URL anywhere.
        transformation: [{ width: 1200, height: 900, crop: 'limit', quality: 'auto' }],
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url:       result.secure_url,
          provider:  'cloudinary',
          sizeBytes: result.bytes,
          mimeType,
        });
      },
    );
    stream.end(buffer);
  });
}

async function storeOnLocalDisk ({ buffer, mimeType, ownerId, sourceName }) {
  const ext      = EXT_BY_MIME[mimeType] || 'bin';
  const dir      = path.join(UPLOAD_ROOT, MENU_SUBDIR, String(ownerId));
  await fs.promises.mkdir(dir, { recursive: true });

  // Random 16-byte name keeps two partners from colliding on the same source
  // filename, and prevents user-supplied path traversal via the original name.
  const safeName = crypto.randomBytes(16).toString('hex') + '.' + ext;
  const target   = path.join(dir, safeName);

  await fs.promises.writeFile(target, buffer);

  // Public URL — served by express.static('/uploads', UPLOAD_ROOT) in index.js.
  // The path is relative to the API base so it works on web + native.
  const url = `/uploads/${MENU_SUBDIR}/${ownerId}/${safeName}`;
  return {
    url,
    provider:  'local',
    sizeBytes: buffer.length,
    mimeType,
    sourceName,                            // for logging only
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function storeImage ({ buffer, mimeType, ownerId, sourceName }) {
  if (!buffer || !buffer.length) throw new Error('Empty file');
  if (buffer.length > MAX_BYTES) throw new Error(`File too large: max ${MAX_BYTES / (1024 * 1024)} MB`);
  if (!ALLOWED.has(mimeType))    throw new Error(`Unsupported file type: ${mimeType}`);

  if (HAS_CLOUDINARY) return storeOnCloudinary({ buffer, mimeType, ownerId });
  return storeOnLocalDisk({ buffer, mimeType, ownerId, sourceName });
}

module.exports = {
  uploadMw,
  storeImage,
  // Surface for diagnostics / health endpoints.
  storageProvider: HAS_CLOUDINARY ? 'cloudinary' : 'local',
  MAX_BYTES,
  ALLOWED_MIME: Array.from(ALLOWED),
  UPLOAD_ROOT,
};
