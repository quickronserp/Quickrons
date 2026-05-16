# Quickrons Admin Console

Next.js 14 app router + Tailwind. Single-screen ops console for the launch zone.

## Run

```bash
cp ../backend/.env.example .env.local   # only need NEXT_PUBLIC_API_BASE / NEXT_PUBLIC_WS_BASE
npm install
npm run dev    # http://localhost:3000
```

If the backend is not running, the dashboard renders with mock data so you can iterate
on UI without starting the full stack.

## What's on the screen

- 4 KPI tiles (open orders, today's orders, today's GMV, SLA breaches)
- Live order feed (subscribes to `order.placed`, `order.transition` over Socket.io)
- Partner status strip (online/offline, open orders, capacity left)
- Rider availability strip (online/offline, status, deliveries today, earnings)

## Auth

Phase 1 expects you to drop a JWT into `localStorage` under `quickrons.adminToken`. We'll add
a real `/admin/login` form that hits `/api/v1/auth/otp/request` + `/verify` once we wire
ops users into the backend (currently any user with role OPS or ADMIN can sign in).

## Deploy

Vercel — connect this folder as the root. Set `NEXT_PUBLIC_API_BASE` and
`NEXT_PUBLIC_WS_BASE` to the production API host.
