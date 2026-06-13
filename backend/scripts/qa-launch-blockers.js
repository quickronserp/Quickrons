// Quickrons launch-blocker regression QA.
//
// Drives the live API exactly as the apps do and asserts the launch-blocker
// invariants (image upload, menu item create + remove/archive, UPI-first
// payment + admin verification, COD, delivery-OTP security, privacy,
// server-authoritative totals, ratings).
//
// Menu removal (R1–R8): a removed item must disappear from the partner menu API
// AND the customer menu API, must not be orderable, and must not be editable —
// while past orders keep their own snapshot (history-safe archive).
//
//   1. Start the backend:   npm start        (from backend/)
//   2. Run this harness:     node scripts/qa-launch-blockers.js
//
// Override the target with QA_BASE=http://host:port. Uses the dev OTP (123456),
// so ALLOW_DEV_OTP must be enabled (non-production only).
//
// NOTE: this creates throwaway test orders + one test dish (the dish is
// soft-deleted at the end). Run against dev/staging, not a pristine demo DB.

const BASE = process.env.QA_BASE || 'http://localhost:8080';
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); if (!cond) console.log('  !! FAIL:', name, extra); };

async function j(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
async function login(phone, role) {
  await j('/api/v1/auth/send-otp', { method: 'POST', body: { phone, role } });
  return (await j('/api/v1/auth/verify-otp', { method: 'POST', body: { phone, otp: '123456', role } })).data.accessToken;
}
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
async function uploadFile(token, buf, filename, type) {
  const form = new FormData();
  form.append('file', new Blob([buf], { type }), filename);
  const res = await fetch(`${BASE}/api/v1/partner/menu/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

(async () => {
  const cust = await login('9876543210', 'CUSTOMER');
  const partner = await login('9876543211', 'PARTNER');
  const rider = await login('9876543212', 'RIDER');
  const admin = await login('9876543219', 'ADMIN');
  ok('all roles login', cust && partner && rider && admin);

  // Image upload
  const up = await uploadFile(partner, PNG_1x1, 'photo.png', 'image/png');
  ok('1. upload accepts real image', up.status === 201 && !!up.data.url);
  const imgUrl = up.data.url;
  const bad = await uploadFile(partner, Buffer.from('not an image'), 'evil.txt', 'text/plain');
  ok('2. upload rejects non-image (400)', bad.status === 400);
  const served = await fetch(`${BASE}${imgUrl}`);
  ok('3. uploaded URL serves', served.status === 200 && (served.headers.get('content-type') || '').startsWith('image/'));
  await j('/api/v1/partner/me', { method: 'PATCH', token: partner, body: { bannerImageUrl: imgUrl, profileImageUrl: imgUrl, galleryUrls: [imgUrl] } });
  const me = await j('/api/v1/partner/me', { token: partner });
  ok('4. partner cover/profile/gallery persist', me.data.partner.bannerImageUrl === imgUrl && me.data.partner.profileImageUrl === imgUrl && (me.data.partner.galleryUrls || []).includes(imgUrl));
  const partnerId = me.data.partner.id;
  const dishUp = await uploadFile(partner, PNG_1x1, 'dish.png', 'image/png');
  const created = await j('/api/v1/partner/menu', { method: 'POST', token: partner, body: { name: 'QA Test Dish', description: 'temp', pricePaise: 12000, category: 'mains', imageUrl: dishUp.data.url } });
  const dishId = created.data.item?.id;
  ok('5. menu image persists', created.status === 201 && created.data.item.imageUrl === dishUp.data.url);
  const kd = await j(`/api/v1/kitchens/${partnerId}`, { token: cust });
  ok('6. customer sees partner image', kd.data.kitchen.bannerImageUrl === imgUrl);
  const cmenu = await j(`/api/v1/kitchens/${partnerId}/menu`, { token: cust });
  ok('6b. customer sees dish image', (cmenu.data.items || []).some(i => i.imageUrl === dishUp.data.url));
  const sellable = (cmenu.data.items || []).find(i => i.pricePaise > 0) || cmenu.data.items[0];

  // ── Menu item removal / archive (web-safe Remove flow) ──────────────────────
  // Create a throwaway dish, confirm it's visible, remove it, then confirm it
  // vanishes from BOTH the partner list and the customer menu — and that a
  // customer can no longer order it (history-safe soft delete / archive).
  const rmCreate = await j('/api/v1/partner/menu', { method: 'POST', token: partner, body: { name: 'QA Remove Me', description: 'to be removed', pricePaise: 9900, category: 'mains', imageUrl: dishUp.data.url } });
  const rmId = rmCreate.data.item?.id;
  ok('R1. create QA menu item', rmCreate.status === 201 && !!rmId);

  const partnerBefore = await j('/api/v1/partner/menu', { token: partner });
  ok('R2. new item shows in partner menu', (partnerBefore.data.items || []).some(i => i.id === rmId && i.active));
  const custBefore = await j(`/api/v1/kitchens/${partnerId}/menu`, { token: cust });
  ok('R3. new item shows in customer menu', (custBefore.data.items || []).some(i => i.id === rmId));

  const removed = await j(`/api/v1/partner/menu/${rmId}`, { method: 'DELETE', token: partner });
  ok('R4. remove/archive returns 200 + archivedAt set', removed.status === 200 && !!removed.data.item.archivedAt && removed.data.item.active === false);

  const partnerAfter = await j('/api/v1/partner/menu', { token: partner });
  ok('R5. removed item hidden from partner menu API', !(partnerAfter.data.items || []).some(i => i.id === rmId));
  const custAfter = await j(`/api/v1/kitchens/${partnerId}/menu`, { token: cust });
  ok('R6. removed item hidden from customer menu API', !(custAfter.data.items || []).some(i => i.id === rmId));

  const orderRemoved = await j('/api/v1/orders', { method: 'POST', token: cust, body: { paymentMethod: 'COD', items: [{ menuItemId: rmId, qty: 1 }] } });
  ok('R7. removed item not orderable', orderRemoved.status === 400);

  const editRemoved = await j(`/api/v1/partner/menu/${rmId}`, { method: 'PATCH', token: partner, body: { name: 'resurrected' } });
  ok('R8. removed item cannot be edited (404)', editRemoved.status === 404);

  // UPI payment
  const noRef = await j('/api/v1/orders', { method: 'POST', token: cust, body: { paymentMethod: 'UPI', items: [{ menuItemId: sellable.id, qty: 1 }] } });
  ok('7. UPI without reference fails', noRef.status === 400);
  const upi = await j('/api/v1/orders', { method: 'POST', token: cust, body: { paymentMethod: 'UPI', paymentRef: 'UTRQA99887766', items: [{ menuItemId: sellable.id, qty: 1 }] } });
  ok('8. UPI with reference succeeds', upi.status === 201);
  ok('9. UPI starts PENDING', upi.data.order.paymentStatus === 'PENDING' && upi.data.order.paymentRefId === 'UTRQA99887766');
  const upi2 = await j('/api/v1/orders', { method: 'POST', token: cust, body: { paymentMethod: 'UPI', paymentRef: 'UTRQA22334455', items: [{ menuItemId: sellable.id, qty: 1 }] } });
  const markRes = await j(`/api/v1/admin/orders/${upi.data.order.id}/payment/mark-paid`, { method: 'POST', token: admin });
  ok('10. admin Mark Paid → CAPTURED', markRes.status === 200 && markRes.data.order.paymentStatus === 'CAPTURED' && !!markRes.data.order.paymentCapturedAt);
  const rejRes = await j(`/api/v1/admin/orders/${upi2.data.order.id}/payment/reject`, { method: 'POST', token: admin, body: { reason: 'not received' } });
  ok('11. admin Reject Payment → FAILED', rejRes.status === 200 && rejRes.data.order.paymentStatus === 'FAILED');
  ok('11b. rejected order not deleted', (await j(`/api/v1/orders/${upi2.data.order.id}`, { token: cust })).status === 200);

  // COD lifecycle + security
  const cod = await j('/api/v1/orders', { method: 'POST', token: cust, body: { paymentMethod: 'COD', items: [{ menuItemId: sellable.id, qty: 2 }] } });
  ok('12. COD order works', cod.status === 201);
  const order = cod.data.order;
  ok('18. backend total = parts', order.totalPaise === order.subtotalPaise + order.deliveryFeePaise + order.packagingFeePaise + order.taxPaise);
  ok('17a. no rider phone in customer payload', !order.rider || !order.rider.user);
  await j(`/api/v1/partner/orders/${order.id}/accept`, { method: 'POST', token: partner });
  await j(`/api/v1/partner/orders/${order.id}/preparing`, { method: 'POST', token: partner });
  await j(`/api/v1/partner/orders/${order.id}/ready`, { method: 'POST', token: partner });
  await j('/api/v1/rider/me/online', { method: 'POST', token: rider, body: { isOnline: true } });
  await j(`/api/v1/rider/orders/${order.id}/accept`, { method: 'POST', token: rider });
  const rOrder = ((await j('/api/v1/rider/me/orders', { token: rider })).data.orders || []).find(o => o.id === order.id);
  ok('13. rider payload has no deliveryOtp', rOrder && rOrder.deliveryOtp === undefined);
  ok('17b. rider payload has no customer phone', rOrder && rOrder.customerPhone === undefined);
  const pu = await j(`/api/v1/rider/orders/${order.id}/picked-up`, { method: 'POST', token: rider });
  ok('13b. picked-up response hides OTP', pu.data.order.deliveryOtp === undefined);
  const otp = (await j(`/api/v1/orders/${order.id}`, { token: cust })).data.order.deliveryOtp;
  ok('14. wrong delivery OTP fails', (await j(`/api/v1/rider/orders/${order.id}/delivered`, { method: 'POST', token: rider, body: { code: '0000' } })).status === 400);
  ok('15. correct delivery OTP succeeds', (await j(`/api/v1/rider/orders/${order.id}/delivered`, { method: 'POST', token: rider, body: { code: otp } })).data.order.status === 'DELIVERED');
  ok('16. rating works', (await j(`/api/v1/orders/${order.id}/rating`, { method: 'POST', token: cust, body: { foodRating: 5, deliveryRating: 5, reviewText: 'QA' } })).status === 201);

  if (dishId) await j(`/api/v1/partner/menu/${dishId}`, { method: 'DELETE', token: partner });

  console.log('\n──────── LAUNCH-BLOCKER QA ────────');
  for (const [s, n, e] of results) console.log(`${s}  ${n}${e ? '  (' + e + ')' : ''}`);
  const fails = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - fails}/${results.length} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('QA CRASH', e); process.exit(2); });
