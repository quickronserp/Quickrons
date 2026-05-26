// Quickrons — Phase 2 MVP seed
//
// Idempotent. Safe to re-run. All upserts keyed by natural unique keys.
//
// Order (matches schema dependency graph):
//   1. Zones
//   2. Users (customer, partner-owner, rider-owner)
//   3. Address (for customer)
//   4. User.defaultAddressId update (resolves circular User↔Address FK)
//   5. Partner (Fathima's Kitchen)
//   6. Rider (Rajan K)
//   7. Wallet — PARTNER (Fathima)
//   8. Wallet — RIDER (Rajan)
//   9. MenuItems (5 Kerala dishes under Fathima)
//
// Run:  npm run seed   (or)   node prisma/seed.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── Constants ───────────────────────────────────────────────────────────────

const ZONES = [
  {
    code: 'perinthalmanna',
    nameEn: 'Perinthalmanna',
    nameMl: 'പെരിന്തൽമണ്ണ',
    district: 'Malappuram',
    pincodes: ['679322', '679323', '679325', '679340'],
    isActive: true,
    centerLat: '10.9760000',
    centerLng: '76.2270000',
    radiusKm: '6.00',
    launchedAt: new Date(),
  },
];

const USERS = [
  { phone: '9876543210', name: 'Test Customer',   role: 'CUSTOMER' },
  { phone: '9876543211', name: 'Fathima',          role: 'PARTNER'  },
  { phone: '9876543212', name: 'Rajan K',          role: 'RIDER'    },
  { phone: '9876543219', name: 'Quickrons Admin',  role: 'ADMIN'    },
];

const MENU = [
  {
    name: 'Thalassery Chicken Biryani',
    description: 'Kaima rice, slow-cooked Malabar masala, raita & lemon pickle.',
    pricePaise: 22900,
    isVeg: false,
    signature: true,
    sortOrder: 1,
    category: 'biryani',
    dailyQuantityLimit: 40,
    dailyQuantityRemaining: 40,
    servingStartMinutes: 11 * 60,   // 11:00
    servingEndMinutes:   22 * 60,   // 22:00
  },
  {
    name: 'Beef Fry + Parotta',
    description: 'Slow-roasted beef pieces with two layered Malabar parottas.',
    pricePaise: 18900,
    isVeg: false,
    signature: false,
    sortOrder: 2,
    category: 'mains',
    dailyQuantityLimit: 60,
    dailyQuantityRemaining: 60,
    servingStartMinutes: 12 * 60,
    servingEndMinutes:   22 * 60,
  },
  {
    name: 'Kerala Sadhya (Mini)',
    description: '12-item banana-leaf veg meal in eco-friendly container.',
    pricePaise: 19900,
    isVeg: true,
    signature: false,
    sortOrder: 3,
    category: 'mains',
    dailyQuantityLimit: 30,
    dailyQuantityRemaining: 30,
    servingStartMinutes: 12 * 60,
    servingEndMinutes:   15 * 60,
  },
  {
    name: 'Puttu + Kadala Curry',
    description: 'Steamed rice puttu with black chana curry. Breakfast staple.',
    pricePaise: 7900,
    isVeg: true,
    signature: false,
    sortOrder: 4,
    category: 'breakfast',
    dailyQuantityLimit: 80,
    dailyQuantityRemaining: 80,
    servingStartMinutes:  7 * 60,
    servingEndMinutes:   10 * 60 + 30,
  },
  {
    name: 'Malabar Fish Curry Meals',
    description: 'Red fish curry, rice, thoran, pappadam — daily fresh.',
    pricePaise: 16900,
    isVeg: false,
    signature: true,
    sortOrder: 5,
    category: 'mains',
    dailyQuantityLimit: 40,
    dailyQuantityRemaining: 40,
    servingStartMinutes: 12 * 60,
    servingEndMinutes:   15 * 60,
  },
];

// ─── Seed ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Zones
  console.log('[seed] zones…');
  for (const z of ZONES) {
    await prisma.zone.upsert({
      where:  { code: z.code },
      update: { ...z },
      create: { ...z },
    });
  }
  console.log(`  ✓ ${ZONES.length} zone(s)`);

  // 2. Users — leave defaultAddressId NULL for now to avoid circular FK.
  console.log('[seed] users…');
  const userByPhone = {};
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where:  { phone: u.phone },
      update: { name: u.name, role: u.role, isActive: true },
      create: { phone: u.phone, name: u.name, role: u.role, isActive: true },
    });
    userByPhone[u.phone] = user;
  }
  console.log(`  ✓ ${USERS.length} users`);

  const customer = userByPhone['9876543210'];
  const partnerOwner = userByPhone['9876543211'];
  const riderOwner = userByPhone['9876543212'];

  // 3. Address — one HOME address for the customer in Perinthalmanna.
  console.log('[seed] address…');
  //   Idempotent key: (userId, label, line1). No native unique on this tuple,
  //   so findFirst + update / create.
  const addrPayload = {
    userId:    customer.id,
    label:     'HOME',
    recipient: 'Test Customer',
    phone:     customer.phone,
    line1:     'House No. 14, Pattambi Road',
    line2:     'Near Juma Masjid',
    landmark:  'Opposite GHSS',
    city:      'Perinthalmanna',
    district:  'Malappuram',
    pincode:   '679322',
    zoneCode:  'perinthalmanna',
    lat:       '10.9762400',
    lng:       '76.2274100',
    notes:     'Ring the bell once — gate stays open.',
    isDefault: true,
  };
  const existingAddr = await prisma.address.findFirst({
    where: { userId: customer.id, label: 'HOME', line1: addrPayload.line1, archivedAt: null },
  });
  const address = existingAddr
    ? await prisma.address.update({ where: { id: existingAddr.id }, data: addrPayload })
    : await prisma.address.create({ data: addrPayload });
  console.log(`  ✓ address ${address.id}`);

  // 4. Link the customer's default address (resolves the circular FK).
  if (customer.defaultAddressId !== address.id) {
    await prisma.user.update({
      where: { id: customer.id },
      data:  { defaultAddressId: address.id },
    });
  }
  console.log('  ✓ customer.defaultAddressId linked');

  // 5. Partner — Fathima's Kitchen (HOME_MAKER, perinthalmanna, ACTIVE).
  console.log('[seed] partner…');
  const partner = await prisma.partner.upsert({
    where:  { userId: partnerOwner.id },
    update: {
      brand:         "Fathima's Kitchen",
      ownerName:     'Fathima',
      category:      'HOME_MAKER',
      kycStatus:     'APPROVED',
      isActive:      true,
      zoneCode:      'perinthalmanna',
      commissionBps: 1000,  // home-maker cap = 10%
      fssaiNumber:   'FSSAI-DEV-FATHIMA',
    },
    create: {
      userId:        partnerOwner.id,
      brand:         "Fathima's Kitchen",
      ownerName:     'Fathima',
      category:      'HOME_MAKER',
      kycStatus:     'APPROVED',
      isActive:      true,
      zoneCode:      'perinthalmanna',
      commissionBps: 1000,
      fssaiNumber:   'FSSAI-DEV-FATHIMA',
    },
  });
  console.log(`  ✓ partner ${partner.brand}`);

  // 6. Rider — Rajan K (BIKE, perinthalmanna, ACTIVE, offline at boot).
  console.log('[seed] rider…');
  const rider = await prisma.rider.upsert({
    where:  { userId: riderOwner.id },
    update: {
      fullName:      'Rajan K',
      vehicleType:   'BIKE',
      vehicleNumber: 'KL-55-AB-2421',
      kycStatus:     'APPROVED',
      isActive:      true,
      isOnline:      false,
      zoneCode:      'perinthalmanna',
    },
    create: {
      userId:        riderOwner.id,
      fullName:      'Rajan K',
      vehicleType:   'BIKE',
      vehicleNumber: 'KL-55-AB-2421',
      kycStatus:     'APPROVED',
      isActive:      true,
      isOnline:      false,
      zoneCode:      'perinthalmanna',
    },
  });
  console.log(`  ✓ rider ${rider.fullName}`);

  // 7. Partner wallet (PARTNER xor — partnerId set, riderId null).
  console.log('[seed] partner wallet…');
  await prisma.wallet.upsert({
    where:  { partnerId: partner.id },
    update: {
      ownerType: 'PARTNER',
      riderId:   null,
      currency:  'INR',
    },
    create: {
      ownerType:           'PARTNER',
      partnerId:           partner.id,
      riderId:             null,
      balancePaise:        0n,
      holdPaise:           0n,
      lifetimeCreditPaise: 0n,
      lifetimeDebitPaise:  0n,
      currency:            'INR',
    },
  });
  console.log('  ✓ partner wallet');

  // 8. Rider wallet (RIDER xor — riderId set, partnerId null).
  console.log('[seed] rider wallet…');
  await prisma.wallet.upsert({
    where:  { riderId: rider.id },
    update: {
      ownerType: 'RIDER',
      partnerId: null,
      currency:  'INR',
    },
    create: {
      ownerType:           'RIDER',
      riderId:             rider.id,
      partnerId:           null,
      balancePaise:        0n,
      holdPaise:           0n,
      lifetimeCreditPaise: 0n,
      lifetimeDebitPaise:  0n,
      currency:            'INR',
    },
  });
  console.log('  ✓ rider wallet');

  // 9. Menu items — all under Fathima's Kitchen.
  console.log('[seed] menu items…');
  for (const m of MENU) {
    const data = {
      partnerId:              partner.id,
      name:                   m.name,
      description:            m.description,
      pricePaise:             m.pricePaise,
      isVeg:                  m.isVeg,
      signature:              m.signature,
      active:                 true,
      sortOrder:              m.sortOrder,
      category:               m.category,
      dailyQuantityLimit:     m.dailyQuantityLimit,
      dailyQuantityRemaining: m.dailyQuantityRemaining,
      servingStartMinutes:    m.servingStartMinutes,
      servingEndMinutes:      m.servingEndMinutes,
      lastResetAt:            new Date(),
    };
    const existing = await prisma.menuItem.findFirst({
      where: { partnerId: partner.id, name: m.name },
    });
    if (existing) {
      await prisma.menuItem.update({ where: { id: existing.id }, data });
    } else {
      await prisma.menuItem.create({ data });
    }
  }
  console.log(`  ✓ ${MENU.length} menu items`);

  console.log('[seed] done.');
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
