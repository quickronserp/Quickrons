// Reliable image picking + client-side resize for all Quickrons upload points
// (partner cover, profile, gallery, dish photos).
//
// Why this module exists: expo-image-picker's web path is unreliable (silent
// no-ops, blocked pickers). On web we therefore use a real hidden
// <input type="file"> + a canvas resize/recompress, which:
//   • always opens the OS file picker on a user gesture,
//   • accepts anything the browser can decode (incl. HEIC where the OS decodes
//     it) and RE-ENCODES to JPEG, so the backend only ever sees jpeg/png/webp,
//   • shrinks huge phone-camera images so uploads don't blow the size limit.
//
// On native we keep expo-image-picker (camera + library) and, when
// expo-image-manipulator is installed, resize there too. Both paths return a
// payload ready for FormData.append('file', payload):
//   • web    → a File (image/jpeg)
//   • native → { uri, name, type }
//
// Returns null when the user cancels.

import { Platform } from 'react-native';

let ImagePicker = null;
try { ImagePicker = require('expo-image-picker'); } catch (_) { /* npx expo install expo-image-picker */ }

let ImageManipulator = null;
try { ImageManipulator = require('expo-image-manipulator'); } catch (_) { /* optional: npx expo install expo-image-manipulator */ }

// Per-slot resize targets + edit aspect + recommended display size.
export const IMAGE_TARGETS = {
  cover:   { maxW: 1600, maxH: 600,  aspect: [3, 1], recommend: '1200×400' },
  banner:  { maxW: 1600, maxH: 600,  aspect: [3, 1], recommend: '1200×400' },
  profile: { maxW: 1000, maxH: 1000, aspect: [1, 1], recommend: '800×800' },
  dish:    { maxW: 1200, maxH: 900,  aspect: [4, 3], recommend: '1000×750' },
  gallery: { maxW: 1400, maxH: 1050, aspect: [4, 3], recommend: '1200×900' },
};

const MAX_INPUT_BYTES = 25 * 1024 * 1024; // reject absurd files before processing

function targetFor(slot) {
  return IMAGE_TARGETS[slot] || IMAGE_TARGETS.dish;
}

// ─── Web: hidden file input + canvas resize ──────────────────────────────────

function pickImageWeb(slot) {
  const target = targetFor(slot);
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';            // let the OS offer HEIC etc.; we re-encode
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);

    let handled = false;
    const cleanup = () => { try { document.body.removeChild(input); } catch (_) {} };

    input.onchange = async () => {
      handled = true;
      const file = input.files && input.files[0];
      cleanup();
      if (!file) return resolve(null);
      if (file.size > MAX_INPUT_BYTES) {
        return reject(new Error('That image is very large. Please choose one under 25 MB.'));
      }
      try {
        resolve(await resizeWeb(file, target));
      } catch (e) {
        reject(e);
      }
    };

    // Best-effort cancel detection: if the window regains focus and no file was
    // chosen, treat it as a cancel so callers don't hang on a spinner.
    const onFocus = () => {
      setTimeout(() => {
        if (!handled) { cleanup(); window.removeEventListener('focus', onFocus); resolve(null); }
      }, 400);
    };
    window.addEventListener('focus', onFocus, { once: true });

    input.click();
  });
}

async function resizeWeb(file, target) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Could not read the selected file'));
    r.readAsDataURL(file);
  });

  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('That image format is not supported. Try JPG, PNG or WebP.'));
    i.src = dataUrl;
  });

  const scale = Math.min(1, target.maxW / img.width, target.maxH / img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not process the image. Please try a different one.');
  return new File([blob], 'upload.jpg', { type: 'image/jpeg' });
}

// ─── Native: expo-image-picker (+ optional manipulator resize) ───────────────

async function pickImageNative(slot, source) {
  if (!ImagePicker) {
    const e = new Error('SETUP_REQUIRED');
    e.setup = true;
    throw e;
  }
  const target = targetFor(slot);

  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { const e = new Error('Camera permission denied'); e.permission = true; throw e; }
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { const e = new Error('Gallery permission denied'); e.permission = true; throw e; }
  }

  const launcher = source === 'camera'
    ? ImagePicker.launchCameraAsync
    : ImagePicker.launchImageLibraryAsync;

  const result = await launcher({
    mediaTypes: ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : 'Images',
    allowsEditing: true,
    aspect: target.aspect,
    quality: 0.85,
  });
  if (result.canceled) return null;
  const asset = result.assets && result.assets[0];
  if (!asset) return null;

  let uri  = asset.uri;
  let type = asset.mimeType || (uri.endsWith('.png') ? 'image/png' : 'image/jpeg');

  // Resize/recompress to keep big camera images (and HEIC) within limits and
  // normalise to JPEG. Skipped silently if the optional module isn't installed.
  if (ImageManipulator) {
    try {
      const out = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: target.maxW } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      uri = out.uri;
      type = 'image/jpeg';
    } catch (_) { /* fall back to the original asset */ }
  }

  const ext  = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const name = asset.fileName || `upload.${ext}`;
  return { uri, name, type };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const imagePickerAvailable = Platform.OS === 'web' || !!ImagePicker;

// pickImage(slot, { source }) → File | { uri, name, type } | null
//   slot:   'cover' | 'banner' | 'profile' | 'dish' | 'gallery'
//   source: 'camera' | 'library' (native only; ignored on web)
export async function pickImage(slot, { source = 'library' } = {}) {
  if (Platform.OS === 'web') return pickImageWeb(slot);
  return pickImageNative(slot, source);
}
