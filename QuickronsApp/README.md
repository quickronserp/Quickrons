# Quickrons — Mobile App (Expo, iOS + Android)

A premium-first food platform integrating **Forra Foods (flagship)**, **home makers**, **premium hotels**, **caterers**, and **branded riders** — all in one app.

This is the MVP starter shipped alongside the business plan in the parent folder.

---

## What's inside

```
QuickronsApp/
├── App.js                       # Root navigator (bottom tabs + modal stack)
├── app.json                     # Expo config (iOS + Android bundle IDs)
├── package.json                 # Dependencies — Expo 50, RN 0.73, React Navigation 6
├── babel.config.js
└── src/
    ├── theme.js                 # Colors, spacing, segment metadata
    ├── state/
    │   └── CartContext.js       # In-memory cart + role + Plus state
    ├── data/
    │   └── mockData.js          # Mock partners (Forra, home makers, hotels, caterers) + rider profile
    ├── components/
    │   ├── PartnerCard.js
    │   ├── DishCard.js
    │   └── SegmentBadge.js      # Renders the segment chip (forra / homeMaker / hotel / caterer)
    └── screens/
        ├── HomeScreen.js              # Quick Today / Curated tabs, segment filters, Forra spotlight
        ├── PartnerScreen.js           # Partner detail + menu
        ├── CartScreen.js              # Cart with commission breakdown
        ├── CheckoutScreen.js          # Address + UPI/card/COD
        ├── TrackingScreen.js          # 5-stage live tracking with rider card
        ├── PremiumScreen.js           # Quickrons Plus subscription
        ├── PartnerOnboardingScreen.js # 3-step partner signup (homeMaker / hotel / caterer)
        ├── RiderScreen.js             # Rider dashboard — earnings, active deliveries
        └── ProfileScreen.js           # Profile + role switcher (customer / rider / partner)
```

---

## Run it on your phone in under 5 minutes

You don't need Xcode or Android Studio for development. Expo Go is enough.

### Prerequisites

1. **Node.js 18+** — install from [nodejs.org](https://nodejs.org)
2. **Expo Go app** on your phone — install from the App Store (iOS) or Play Store (Android)

### Steps

```bash
cd "QuickronsApp"
npm install
npx expo start
```

A QR code will appear in your terminal.

- **iOS:** open the Camera app, point at the QR code, tap the Expo Go banner.
- **Android:** open Expo Go, tap "Scan QR code", point at the terminal.

The app will hot-reload on every file save.

### Run in a simulator/emulator (optional)

```bash
npx expo start --ios       # iOS simulator (requires Xcode on Mac)
npx expo start --android   # Android emulator (requires Android Studio)
```

### Build standalone iOS / Android binaries

When you're ready to ship to the App Store or Play Store, use EAS Build:

```bash
npm install -g eas-cli
eas login
eas build --platform ios
eas build --platform android
```

Bundle IDs are pre-configured in `app.json`:
- iOS: `com.forrafoods.quickrons`
- Android: `com.forrafoods.quickrons`

---

## What works in this MVP

| Feature                                | Status |
|----------------------------------------|--------|
| Browse partners across 4 segments      | ✅      |
| Forra Foods flagship spotlight         | ✅      |
| Quick Today / Curated tabs             | ✅      |
| Segment filter chips                   | ✅      |
| Partner detail + menu + add to cart    | ✅      |
| Cart with commission breakdown + GST   | ✅      |
| Checkout (UPI / Card / COD picker)     | ✅      |
| 5-stage live tracking simulation       | ✅      |
| Quickrons Plus subscription flow       | ✅      |
| Partner onboarding (3-step wizard)     | ✅      |
| Rider dashboard (earnings + jobs)      | ✅      |
| Profile + role switcher                | ✅      |

---

## What's mocked vs. needs a backend

**Mocked (in `src/data/mockData.js`):** partners, dishes, rider profile, active deliveries.

**Needs a backend before launch:** auth (phone OTP), real menu API, payments (Razorpay), live rider locations (Socket.io + Mapbox), push notifications (Expo Notifications), order history persistence.

The recommended stack from the business plan: Node.js + Express + PostgreSQL + Redis on AWS Mumbai, Razorpay for payments, Mapbox for maps, Socket.io for real-time rider tracking.

---

## Try the multi-role flow

The app supports three roles in a single account:

1. Open the app → tap the **avatar** (top right) → **Account**.
2. Under **Switch role**, tap **Rider** — a new "Deliveries" tab appears in the bottom navigation showing active jobs and earnings.
3. Switch back to **Customer** to resume ordering. Tap **Become a partner** to walk through the home-maker / hotel / caterer onboarding wizard.

This is the structural moat — Quickrons is one app for every party, while Zomato/Swiggy split customer, rider and partner into separate apps.

---

## Brand

- **Primary:** `#E11D48` (Quickrons rose)
- **Forra Foods:** `#7C2D12` (deep terracotta)
- **Home maker green:** `#15803D`
- **Premium hotel:** `#7C3AED`
- **Caterer:** `#0EA5E9`

Edit `src/theme.js` to retune.

---

## License

Proprietary — Forra Foods / Quickrons. © 2026.
