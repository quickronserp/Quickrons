# Railway Deployment Checklist — Quickrons Backend

## 1. Railway Service Setup

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select: `quickronserp/Quickrons`
3. Railway will ask which directory — set:

| Setting | Value |
|---|---|
| **Root Directory** | `backend` |
| **Build Command** | `npm install && npx prisma generate` |
| **Start Command** | `npm start` |

> Railway auto-detects Node.js. If it creates its own build command, override it with the values above.

---

## 2. Environment Variables

In Railway → your service → **Variables** tab, add these exactly:

```
DATABASE_URL        = <your Railway PostgreSQL connection string>
JWT_SECRET          = <generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_REFRESH_SECRET  = <generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
OTP_DEV_BYPASS      = false
CORS_ORIGIN         = *
NODE_ENV            = production
```

> `PORT` — do NOT set. Railway injects it automatically.
>
> `DATABASE_URL` — copy from Railway PostgreSQL service → Connect → Postgres Connection URL.
>
> `CORS_ORIGIN` — set to `*` to start. After launch, lock to your Expo domain if needed.

---

## 3. Add PostgreSQL (if not already added)

1. Railway → New → Database → Add PostgreSQL
2. It auto-connects to your project
3. Copy the `DATABASE_URL` from its Variables tab into your backend service Variables

---

## 4. One-Time Commands (run after first deploy)

In Railway → your backend service → **Deploy** tab → click the active deployment → **Terminal** (or use Railway CLI):

```bash
# Run migrations
npx prisma migrate deploy

# Seed the database (only if you have seed data)
node prisma/seed.js
```

> These only need to run once. For all future deploys, Railway auto-runs the build command which includes `prisma generate` only. If you add new migrations, re-run `npx prisma migrate deploy` via the terminal.

---

## 5. Get Your Railway Backend URL

After deploy: Railway → your service → **Settings** → copy the public domain.

It will look like: `https://quickrons-backend-production-xxxx.up.railway.app`

---

## 6. Connect QuickronsApp to Railway Backend

### For local development (Expo Go on your phone)

Edit `QuickronsApp/.env`:
```
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8080
```
Replace `YOUR_LOCAL_IP` with your Mac's LAN IP (e.g. `192.168.1.10`). Find it with:
```bash
ipconfig getifaddr en0
```

### For production / staging

Edit `QuickronsApp/.env`:
```
EXPO_PUBLIC_API_URL=https://quickrons-backend-production-xxxx.up.railway.app
```

Then restart Expo:
```bash
cd QuickronsApp
npx expo start --clear
```

---

## 7. Validation — Test the Deployed Backend

Replace `YOUR_RAILWAY_URL` with your actual Railway domain:

```bash
# Health check — must return {"status":"Quickrons backend live","db":"up"}
curl https://YOUR_RAILWAY_URL/health

# Auth — send OTP (with dev bypass off, this sends a real OTP)
curl -X POST https://YOUR_RAILWAY_URL/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919999999999"}'

# Kitchens list (requires valid JWT — use after login)
curl https://YOUR_RAILWAY_URL/api/v1/kitchens \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

If `/health` returns `"db":"down"`, check that `DATABASE_URL` is set correctly in Railway Variables.

---

## 8. Future Deploys

Railway auto-deploys on every push to `main`. No manual steps needed after the initial migration.

If you add a new Prisma migration locally (`prisma migrate dev`), after pushing run:
```bash
npx prisma migrate deploy   # via Railway terminal
```
