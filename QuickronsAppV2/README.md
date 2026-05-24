# QuickronsAppV2

Clean Expo SDK 50 build of the Quickrons mobile app. Web-runnable out of the box.

## Run

```bash
cd "/Users/shakeebali/Documents/Claude/Projects/Quickrons/QuickronsAppV2"
npm install
npx expo start --web --clear
```

Open the printed `http://localhost:NNNN` URL (default 8081).

## Login test

| field | value |
|---|---|
| phone | `9876543210` |
| OTP   | `123456` |

(Auto-verifies on the 6th digit; persists session in `localStorage` under `quickrons.session`. To re-test the login screen after signing in, click **Sign out** on the home screen, or run `localStorage.removeItem('quickrons.session')` in the browser console.)

## Backend

`http://localhost:8080` — endpoints used:
- `POST /api/v1/auth/send-otp`
- `POST /api/v1/auth/verify-otp`

Override the base URL by adding `expo.extra.apiBase` to `app.json` if your backend lives elsewhere.

## Stack

Expo 50 · React Native 0.73.6 · React Navigation 6 (native-stack only) · No expo-secure-store · No expo-router.
