# Privacy: Rider ⇄ Customer Masked Calling

**Status:** MVP abstraction shipped (`backend/src/lib/calling.js`, provider
`app-contact`). Real masking (Twilio / Exotel) is designed below and is a
provider switch away — no client changes required.

Owner: Platform / Trust & Safety · Last updated: 2026-06-04

---

## 1. Problem

During an active delivery the two parties need to reach each other (rider can't
find the gate; customer wants to add a note). Today both apps dial the **real**
personal number:

| Caller | Dials | Source field |
| --- | --- | --- |
| Customer (TrackingScreen) | Rider's real mobile | `order.rider.user.phone` |
| Rider (RiderOpsScreen) | Customer's real mobile | `order.customerPhone` |

Consequences:

- Personal numbers are disclosed to a stranger and **persist** in call logs
  forever — usable after the order ends.
- Harassment / spam / off-platform solicitation vector.
- No audit trail of who contacted whom, when.

**Requirement:** neither party ever sees or retains the other's real number.

---

## 2. Approach (MVP-safe, provider-swappable)

All "call the other party" actions resolve their dial target through a single
module — `backend/src/lib/calling.js` — never by reading the raw counterparty
field in a route or client. The module returns a `Contact`:

```js
Contact = {
  mode:      'direct' | 'proxy',   // proxy = masked
  dial:      '+91…' | null,        // what the app dials
  display:   'Rider' | 'Customer', // label shown instead of the number
  masked:    boolean,
  expiresAt: ISO-8601 | null,      // proxy session expiry
  notice:    string,               // user-facing privacy note
}
```

Provider is env-selected (`CALLING_PROVIDER`, default `app-contact`):

- **`app-contact` (MVP, now).** No third party. Returns the real number, but
  through the *same shape, audit hook, and call path* as the masked providers.
  This is honest about its limits (`masked: false`, a user notice) while giving
  us the structural seam + logging immediately. Privacy hardening = flip the env
  var once a provider is contracted.
- **`twilio` / `exotel` (production).** Return a **proxy number** both parties
  dial; the provider bridges to the real leg and tears the mapping down at order
  completion. Real numbers never leave the backend.

Why an abstraction now instead of waiting: it removes raw numbers from the
client contract, centralises the dial decision, and makes masking a config
change rather than a refactor across every call site.

---

## 3. Target architecture (production)

### 3.1 Endpoint (to wire next)

```
POST /api/v1/orders/:id/contact      (auth: CUSTOMER or RIDER on THIS order)
  → 200 { contact: Contact }
```

Server logic:

1. Load the order; assert the caller is its customer or assigned rider, and the
   order is in a contactable state (`CONFIRMED … OUT_FOR_DELIVERY`). Reject for
   `DELIVERED / CANCELLED / FAILED` — the relationship is over.
2. Determine `callerRole` and resolve the **peer's** real number server-side
   (never sent to the client):
   - customer calling → peer = rider (`order.rider.user.phone`)
   - rider calling → peer = customer (`order.customerPhone`)
3. `const contact = await resolveContact({ order, callerRole, peerRealPhone, peerName })`
4. Write an audit row (`who, orderId, mode, at`) and return `contact`.

Clients dial `contact.dial` and render `contact.display` + `contact.notice`.
They never receive the raw peer number in any list/detail payload.

### 3.2 Twilio Proxy

- Create one **Proxy Service**. On rider assignment, open a **Session** and add
  two Participants (customer real #, rider real #). Twilio issues each a Proxy
  Identifier (a Twilio number).
- `/contact` returns that proxy number as `dial`, `mode: 'proxy'`, `masked: true`,
  `expiresAt` = session TTL (cap to order ETA + buffer).
- Close the Session on `DELIVERED / CANCELLED / FAILED` (hook into the order FSM
  transitions in `routes/rider.js` / `routes/partner.js`).
- SMS within the session is also masked (optional future "message rider").

### 3.3 Exotel (India-first alternative, often better Kerala connectivity)

- Provision an **ExoPhone**. Use Connect / click-to-call: backend calls Exotel's
  connect API with both legs; Exotel rings party A from the ExoPhone, then
  bridges to party B. Caller ID shown is the ExoPhone, not the peer.
- Same `Contact` shape; `dial` may be the ExoPhone (callback model) or the call
  is server-initiated (then `dial` is null and the UI shows "Connecting…").
- Recommended primary for India volume/cost; Twilio as fallback.

### 3.4 Data model additions (when masking goes live)

```prisma
model CallSession {
  id          String   @id @default(cuid())
  orderId     String
  provider    String                    // 'twilio' | 'exotel'
  providerRef String                    // Proxy Session SID / Exotel call SID
  proxyNumber String?
  status      String                    // 'OPEN' | 'CLOSED'
  expiresAt   DateTime?
  createdAt   DateTime @default(now())
  closedAt    DateTime?
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  @@index([orderId])
}
```

(Additive, nullable — same non-destructive migration pattern as the Phase-1
branding fields.)

---

## 4. Rollout

1. **Now (done):** `calling.js` abstraction (`app-contact`). Audit seam ready.
2. **Next:** wire `POST /orders/:id/contact`; switch TrackingScreen +
   RiderOpsScreen to call it instead of `tel:${realNumber}`. Stop sending raw
   peer numbers in order payloads. Still `app-contact`, but numbers leave the
   client contract.
3. **Masking live:** contract Exotel (primary) + Twilio (fallback); implement
   `resolveExotel` / `resolveTwilio` + `CallSession`; set `CALLING_PROVIDER`.
   Open session on rider-assign, close on terminal status.
4. **Hardening:** rate-limit `/contact`; block contact after delivery; T&S
   dashboard over the audit log.

---

## 5. Current limitation (be explicit)

Under `app-contact` the real number is **still exposed** to the counterparty —
this is a structural placeholder, not privacy. The user-facing `notice` says so.
Do not advertise "your number stays private" until `isMaskingConfigured()` is
true.
