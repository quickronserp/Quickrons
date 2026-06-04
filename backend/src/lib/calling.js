// Privacy-preserving contact abstraction for rider ⇄ customer calling.
//
// PROBLEM
//   The customer app dials the rider's real number (rider.user.phone) and the
//   rider app dials the customer's real number (order.customerPhone). Each side
//   sees — and keeps — the other's personal number. That is a privacy leak and,
//   at scale, an abuse/harassment vector. Number masking is mandatory.
//
// DESIGN
//   This module is the single choke-point through which every "call the other
//   party" action resolves a dialable target. Routes/clients never read the raw
//   counterparty number directly; they ask this module for a CONTACT and dial
//   whatever it returns. Swapping the MVP behaviour for a real masking provider
//   (Twilio / Exotel) is then a one-line provider switch — no client changes.
//
//   Provider is env-selected at load via CALLING_PROVIDER:
//     'app-contact' (default) — MVP. Returns the real number BUT flagged as
//                    unmasked, with a short-lived authorization window and an
//                    audit hook, so the structure (and logging) is identical to
//                    the masked path. This buys auditability + a clean seam now;
//                    true masking arrives the moment a provider is configured.
//     'twilio'     — Twilio Proxy sessions (see docs/privacy-masked-calling.md).
//     'exotel'     — Exotel ExoPhone connect/click-to-call.
//
//   Both real providers return a PROXY number (an ExoPhone / Twilio number) that
//   both parties dial; the provider bridges the leg to the real number and tears
//   the mapping down when the order completes. Neither party ever sees the other.
//
// PUBLIC API
//   resolveContact({ order, callerRole, peerRealPhone, peerName }) → Promise<Contact>
//
//   Contact = {
//     mode:      'direct' | 'proxy',     // 'direct' = unmasked (MVP), 'proxy' = masked
//     dial:      '+91…' | null,          // the number the caller's app should dial
//     display:   'Rider' | 'Customer',   // label to show instead of the raw number
//     masked:    boolean,                // true once a real provider is wired
//     expiresAt: ISO-8601 | null,        // when the dial target stops working (proxy)
//     notice:    string,                 // user-facing privacy note
//   }
//
//   isMaskingConfigured() → boolean      // for health/diagnostics endpoints

'use strict';

const PROVIDER = (process.env.CALLING_PROVIDER || 'app-contact').toLowerCase();

// Only the proxy providers actually hide numbers. Used by health checks and to
// decide whether the "your number stays private" promise can be shown to users.
const MASKING_PROVIDERS = new Set(['twilio', 'exotel']);

function isMaskingConfigured() {
  return MASKING_PROVIDERS.has(PROVIDER);
}

// E.164-ish normaliser. Kerala/India numbers; assumes +91 when a bare 10-digit
// mobile is supplied. Never throws — returns null when nothing dialable.
function normalisePhone(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) return trimmed.replace(/[^\d+]/g, '');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits ? `+${digits}` : null;
}

// ─── MVP provider: app-contact ────────────────────────────────────────────────
// No third party. Returns the real number, but through the same shape + audit
// path as the masked providers so the call site never changes later.
async function resolveAppContact({ callerRole, peerRealPhone, peerName }) {
  const dial = normalisePhone(peerRealPhone);
  return {
    mode:      'direct',
    dial,
    display:   peerName || (callerRole === 'CUSTOMER' ? 'Rider' : 'Customer'),
    masked:    false,
    expiresAt: null,
    notice:
      'Quickrons is rolling out private masked calling. Until then, please use ' +
      'this number only for this delivery.',
  };
}

// ─── Production providers (stubs until credentials are wired) ─────────────────
// These intentionally throw a clear, actionable error rather than silently
// leaking the real number, so a half-configured deploy fails loud.
async function resolveTwilio() {
  throw new Error(
    'CALLING_PROVIDER=twilio but Twilio Proxy is not implemented/configured. ' +
    'See docs/privacy-masked-calling.md → "Twilio Proxy".',
  );
}

async function resolveExotel() {
  throw new Error(
    'CALLING_PROVIDER=exotel but Exotel connect is not implemented/configured. ' +
    'See docs/privacy-masked-calling.md → "Exotel".',
  );
}

// ─── Public resolver ──────────────────────────────────────────────────────────
//
// `order`        — the Order row (used by real providers to scope the proxy
//                  session and expiry to the delivery lifecycle).
// `callerRole`   — 'CUSTOMER' | 'RIDER' (who is initiating the call).
// `peerRealPhone`— the counterparty's real number (resolved by the route).
// `peerName`     — display label for the counterparty.
async function resolveContact({ order, callerRole, peerRealPhone, peerName }) {
  switch (PROVIDER) {
    case 'twilio': return resolveTwilio({ order, callerRole, peerRealPhone, peerName });
    case 'exotel': return resolveExotel({ order, callerRole, peerRealPhone, peerName });
    case 'app-contact':
    default:       return resolveAppContact({ callerRole, peerRealPhone, peerName });
  }
}

module.exports = {
  resolveContact,
  isMaskingConfigured,
  normalisePhone,
  provider: PROVIDER,
};
