// Tiny error hierarchy + Express error-handling middleware.
// Throw ApiError from any route; the middleware shapes the JSON response so
// the frontend always gets { error: { code, message, details? } }.

class ApiError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.status  = status;
    this.code    = code;
    this.details = details;
  }
}

const BadRequest    = (msg, details) => new ApiError(msg, { status: 400, code: 'BAD_REQUEST', details });
const Unauthorized  = (msg = 'Unauthorized') => new ApiError(msg, { status: 401, code: 'UNAUTHORIZED' });
const NotFound      = (msg = 'Not found')    => new ApiError(msg, { status: 404, code: 'NOT_FOUND' });
const Conflict      = (msg, details) => new ApiError(msg, { status: 409, code: 'CONFLICT', details });

// Wrap async handlers so thrown errors flow into the error middleware.
const asyncH = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `${req.method} ${req.path} not found` } });
}

function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  // Prisma unique-constraint
  if (err && err.code === 'P2002') {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Resource already exists', details: err.meta } });
  }
  // Fallback
  console.error('[unhandled]', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}

module.exports = { ApiError, BadRequest, Unauthorized, NotFound, Conflict, asyncH, notFoundHandler, errorHandler };
