# Quickrons — Beta Launch Notes

_Last updated: 2026-06-13_

This document captures what is production-ready for a **5–10 user closed beta**,
what is intentionally manual for now, and the plan for live Google Maps delivery
tracking. It is the source of truth for "what works vs. what is not yet
automatic" so the team and beta testers share expectations.

Brand direction: **smart, modern, trustworthy, Kerala-first, premium but
simple.** Tagline: **"For Smart People."** Do not over-use generic
food-delivery copy.

---

## 1. What is working now (beta-ready)

**Customer**
- Mobile-first home: location, language toggle (EN/ML/HI), beta hero, quick
  filters, kitchen cards with image/rating/ETA, skeleton loading.
- Bottom navigation: **Home · Search · Cart · Account**.
- **Search** (real): kitchens (instant, client-side over the live feed) and
  dishes (`GET /api/v1/menu?q=`, only active/non-archived dishes from live,
  KYC-approved kitchens). No fake results.
- Cart + checkout with **server-authoritative totals** (subtotal, delivery,
  packaging, GST). Add-to-cart is instant (local state).
- **UPI-first** checkout: pay out-of-band, enter UTR/reference. Empty/short
  reference shows a clear inline error; payment stays `PENDING` until an
  operator verifies (never auto-confirmed). COD also supported.
- Order tracking: live status stages over websocket, ETA, rider card, secure
  **delivery OTP**, **"Open map"** button (see §3), rating after delivery.

**Partner**
- Self-serve menu CRUD with image upload. **Remove** archives the item
  (history-safe) and hides it from the partner list, customer menu, and ordering
  — works on web and native.
- Order ops: accept / reject / preparing / ready with web-safe confirmations.

**Admin**
- Orders dashboard, analytics, mark-paid / reject-payment, cancel order — all
  with instant feedback and web-safe confirmations.

**Rider**
- Online toggle, accept, picked-up, delivered (OTP-verified). Open customer
  location in Maps. No customer phone leakage (privacy-masked calling).

**Quality / security invariants** are covered by
`backend/scripts/qa-launch-blockers.js` (31 checks, all passing).

---

## 2. What is NOT yet automatic (manual for beta)

- **UPI verification is manual.** An operator marks payments paid/failed in the
  Admin console. There is no PSP webhook yet, so UPI orders stay `PENDING` until
  someone verifies the UTR. This is intentional and clearly messaged to the
  customer ("Payment shows as pending until Quickrons verifies it").
- **No automated discounts / offers engine.** The home promotional area is a
  static, beta-safe banner. We do **not** show "50% off" or any discount the
  backend cannot honour. Delivery/packaging/GST are computed server-side.
- **Live GPS rider tracking is not in-app yet** (see §3). Today the customer
  sees status stages + ETA + an "Open map" button to the delivery address.
- **Grocery** is a "coming soon" empty state — no grocery catalogue yet.

---

## 3. Google Maps / live delivery tracking — current state & plan

### What exists today (no fake tracking)
- The tracking screen has an **"Open map"** action on the delivery address.
  It opens the location in the device's Google Maps app / browser via a
  universal `https://www.google.com/maps/search/?api=1&query=<lat,lng>` URL
  (`openDeliveryMap` in `QuickronsApp/src/screens/TrackingScreen.js`).
  Riders have the equivalent "open customer location" action.
- This requires **no API key** — it uses public Maps URLs and the OS handler.
- Status progression (placed → accepted → ready → on the way → delivered) is
  **real**, driven by websocket events, not simulated movement.

### Future: in-app live map + live rider position
To show an embedded map with a moving rider marker and a route line, we need:

1. **Google Maps Platform API key** with these APIs enabled:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Maps JavaScript API (for Expo Web)
   - Directions API (route line) and optionally Distance Matrix (live ETA)
   - Restrict the key by platform (app bundle IDs / HTTP referrers) and by API.

2. **Env / config wiring** (proposed):
   ```
   # QuickronsApp/.env  (Expo public — safe to ship in client)
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...      # Maps JS + native SDK key (referrer/bundle-restricted)

   # backend/.env  (server-side only — never shipped to client)
   GOOGLE_MAPS_SERVER_KEY=...               # Directions / Distance Matrix / geocoding
   ```
   - `app.json` → add the Android/iOS Maps key under the respective config
     blocks (or via the `react-native-maps` / `expo-maps` config plugin).
   - The Maps JS key is referrer-restricted to the web origin.

3. **Library**: `react-native-maps` (native) + `@vis.gl/react-google-maps` or
   the Maps JS API on web. Keep a single `<DeliveryMap/>` component with a
   platform split so screens stay clean.

4. **Live rider position**: the rider app emits periodic location to the
   backend; the backend relays it over the existing order websocket room; the
   customer map subscribes and animates the marker. Add a `riderLat/riderLng`
   pair to the order websocket payload (never expose rider phone/identity beyond
   what is already allowed).

### Clean interface prepared for this
- Tracking already centralises map-opening in `openDeliveryMap(order)` and reads
  `order.addrLat/addrLng` — the same coordinates a future `<DeliveryMap/>` will
  consume, so swapping the button for an embedded map is localized.
- No code currently fakes a moving rider, so there is nothing to unwind.

**Do not** enable an embedded map until a restricted API key is provisioned and
billing/limits are configured, to avoid leaking an unrestricted key or
incurring surprise cost.

---

## 4. Responsiveness & speed targets

- The customer app is **phone-first**. On desktop web, content is capped to a
  centered ~520px column (`QuickronsApp/src/lib/layout.js`) so it reads like a
  phone app, not a stretched desktop dashboard. On a real phone this is a no-op.
- Perceived-speed measures (local) are recorded in the PR / commit description
  via `backend/scripts/qa-launch-blockers.js` timings and manual checks.
  Targets: home/kitchen usable < 1s locally, add-to-cart instant, partner
  remove/hide and admin actions instant (optimistic UI + refetch).

---

## 5. Beta go / no-go checklist

- [x] Customer home feels mobile-first, no obvious lag
- [x] Bottom nav: Home · Search · Cart · Account
- [x] Search works (kitchens + dishes), clean empty state
- [x] No confusing UPI wording; clear inline validation
- [x] Partner menu actions work (incl. web Remove → archive)
- [x] Admin / rider actions clear, instant feedback
- [x] Delivery tracking polished; map button works; OTP secure
- [x] Image upload works
- [x] `qa-launch-blockers.js` passes
- [ ] Live Google Maps tracking (post-beta — needs API key, see §3)
- [ ] Automated UPI verification via PSP webhook (post-beta)
