// Quickrons — Phase 2 MVP seed
//
// Idempotent. Safe to re-run. All upserts keyed by natural unique keys.
//
// Partners:
//   1. Fathima's Kitchen      — HOME_MAKER
//   2. Malabar Hotel          — RESTAURANT
//   3. Forra Catering         — CATERER
//   4. Ammu's Homely Meals    — HOME_MAKER
//   5. Perinthalmanna Grill House — RESTAURANT
//
// Riders: Rajan K, Shafi P, Navas M
//
// Run:  npm run seed   (or)   node prisma/seed.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── Constants ───���───────────────────────────────────────────────────────────

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

// ─── Users ────────────────────────────────────────────────────────────────────
// phone MUST be unique. Partners/Riders need their own User rows.

const USERS = [
  // Customer
  { phone: '9876543210', name: 'Test Customer',         role: 'CUSTOMER' },
  // Partner owners
  { phone: '9876543211', name: 'Fathima',               role: 'PARTNER'  },
  { phone: '9876543213', name: 'Basheer Malabar Hotel', role: 'PARTNER'  },
  { phone: '9876543214', name: 'Forra Catering Mgr',   role: 'PARTNER'  },
  { phone: '9876543215', name: 'Ammu',                  role: 'PARTNER'  },
  { phone: '9876543216', name: 'Grill House Mgr',       role: 'PARTNER'  },
  // Riders
  { phone: '9876543212', name: 'Rajan K',               role: 'RIDER'    },
  { phone: '9876543217', name: 'Shafi P',               role: 'RIDER'    },
  { phone: '9876543218', name: 'Navas M',               role: 'RIDER'    },
  // Admin
  { phone: '9876543219', name: 'Quickrons Admin',       role: 'ADMIN'    },
];

// ─── Partners ─────────────────────────────────────────────────────────────────

const PARTNERS = [
  {
    phone:         '9876543211',
    brand:         "Fathima's Kitchen",
    ownerName:     'Fathima',
    category:      'HOME_MAKER',
    commissionBps: 1000,
    fssaiNumber:   'FSSAI-DEV-FATHIMA',
  },
  {
    phone:         '9876543213',
    brand:         'Malabar Hotel',
    ownerName:     'Basheer',
    category:      'RESTAURANT',
    commissionBps: 1500,
    fssaiNumber:   'FSSAI-DEV-MALABAR',
  },
  {
    phone:         '9876543214',
    brand:         'Forra Catering',
    ownerName:     'Forra Catering Manager',
    category:      'CATERER',
    commissionBps: 1200,
    fssaiNumber:   'FSSAI-DEV-FORRA',
  },
  {
    phone:         '9876543215',
    brand:         "Ammu's Homely Meals",
    ownerName:     'Ammu',
    category:      'HOME_MAKER',
    commissionBps: 1000,
    fssaiNumber:   'FSSAI-DEV-AMMU',
  },
  {
    phone:         '9876543216',
    brand:         'Perinthalmanna Grill House',
    ownerName:     'Grill House Manager',
    category:      'RESTAURANT',
    commissionBps: 1500,
    fssaiNumber:   'FSSAI-DEV-GRILL',
  },
];

// ─── Riders ────���──────────────────────────────────────────────────────────────

const RIDERS = [
  {
    phone:         '9876543212',
    fullName:      'Rajan K',
    vehicleType:   'BIKE',
    vehicleNumber: 'KL-55-AB-2421',
  },
  {
    phone:         '9876543217',
    fullName:      'Shafi P',
    vehicleType:   'BIKE',
    vehicleNumber: 'KL-10-CJ-5533',
  },
  {
    phone:         '9876543218',
    fullName:      'Navas M',
    vehicleType:   'BIKE',
    vehicleNumber: 'KL-55-BZ-7890',
  },
];

// ─── Menus — keyed by partner phone ──��───────────────────────────────────────

const MENUS = {
  '9876543211': [
    {
      name:        'Thalassery Chicken Biryani',
      description: 'Kaima rice, slow-cooked Malabar masala, raita & lemon pickle.',
      pricePaise:  22900, isVeg: false, signature: true,  sortOrder: 1,
      category:    'biryani',
      dailyQuantityLimit: 40, dailyQuantityRemaining: 40,
      servingStartMinutes: 11 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name:        'Beef Fry + Parotta',
      description: 'Slow-roasted beef pieces with two layered Malabar parottas.',
      pricePaise:  18900, isVeg: false, signature: false, sortOrder: 2,
      category:    'mains',
      dailyQuantityLimit: 60, dailyQuantityRemaining: 60,
      servingStartMinutes: 12 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name:        'Kerala Sadhya (Mini)',
      description: '12-item banana-leaf veg meal in eco-friendly container.',
      pricePaise:  19900, isVeg: true,  signature: false, sortOrder: 3,
      category:    'mains',
      dailyQuantityLimit: 30, dailyQuantityRemaining: 30,
      servingStartMinutes: 12 * 60, servingEndMinutes: 15 * 60,
    },
    {
      name:        'Puttu + Kadala Curry',
      description: 'Steamed rice puttu with black chana curry. Breakfast staple.',
      pricePaise:   7900, isVeg: true,  signature: false, sortOrder: 4,
      category:    'breakfast',
      dailyQuantityLimit: 80, dailyQuantityRemaining: 80,
      servingStartMinutes:  7 * 60, servingEndMinutes: 10 * 60 + 30,
    },
    {
      name:        'Malabar Fish Curry Meals',
      description: 'Red fish curry, rice, thoran, pappadam — daily fresh.',
      pricePaise:  16900, isVeg: false, signature: true,  sortOrder: 5,
      category:    'mains',
      dailyQuantityLimit: 40, dailyQuantityRemaining: 40,
      servingStartMinutes: 12 * 60, servingEndMinutes: 15 * 60,
    },
  ],

  '9876543213': [
    {
      name:        'Malabar Chicken Curry Meals',
      description: 'Fragrant chicken curry, steamed rice, papad & pickle. Hotel-style plate.',
      pricePaise:  17900, isVeg: false, signature: true,  sortOrder: 1,
      category:    'mains',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 11 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name:        'Mutton Biryani (Hotel Style)',
      description: 'Dum-cooked mutton biryani with hotel gravy & raita.',
      pricePaise:  27900, isVeg: false, signature: true,  sortOrder: 2,
      category:    'biryani',
      dailyQuantityLimit: 50, dailyQuantityRemaining: 50,
      servingStartMinutes: 12 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name:        'Porotta + Chicken Roast',
      description: 'Crispy-layered Malabar porotta with spicy dry chicken roast.',
      pricePaise:  17900, isVeg: false, signature: false, sortOrder: 3,
      category:    'mains',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 11 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name:        'Veg Meals',
      description: 'Rice, sambar, avial, thoran, pickle & papad.',
      pricePaise:  10900, isVeg: true,  signature: false, sortOrder: 4,
      category:    'mains',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 11 * 60, servingEndMinutes: 15 * 60,
    },
    {
      name:        'Idiyappam + Egg Curry',
      description: 'Soft rice noodles with creamy coconut egg curry.',
      pricePaise:   9900, isVeg: false, signature: false, sortOrder: 5,
      category:    'breakfast',
      dailyQuantityLimit: 60, dailyQuantityRemaining: 60,
      servingStartMinutes:  7 * 60, servingEndMinutes: 11 * 60,
    },
  ],

  '9876543214': [
    {
      name:        'Party Pack Biryani (10 pax)',
      description: 'Fragrant Malabar chicken biryani packed for events. 10-person serving.',
      pricePaise:  199000, isVeg: false, signature: true,  sortOrder: 1,
      category:    'catering',
      dailyQuantityLimit: 20, dailyQuantityRemaining: 20,
      servingStartMinutes: 10 * 60, servingEndMinutes: 18 * 60,
    },
    {
      name:        'Sadhya Catering (20 pax)',
      description: 'Full Kerala sadya delivered for weddings & functions. 20-person pack.',
      pricePaise:  350000, isVeg: true,  signature: true,  sortOrder: 2,
      category:    'catering',
      dailyQuantityLimit: 10, dailyQuantityRemaining: 10,
      servingStartMinutes:  9 * 60, servingEndMinutes: 14 * 60,
    },
    {
      name:        'Snack Box (Samosa + Tea)',
      description: 'Box of 6 crispy samosas and a flask of ginger tea. Great for meetings.',
      pricePaise:  18900, isVeg: true,  signature: false, sortOrder: 3,
      category:    'snacks',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes:  9 * 60, servingEndMinutes: 18 * 60,
    },
    {
      name:        'Beef Roast Pack (1 kg)',
      description: 'Dry Kerala beef roast, 1 kg. Party-ready, tamper sealed.',
      pricePaise:  55000, isVeg: false, signature: false, sortOrder: 4,
      category:    'catering',
      dailyQuantityLimit: 30, dailyQuantityRemaining: 30,
      servingStartMinutes: 10 * 60, servingEndMinutes: 18 * 60,
    },
  ],

  '9876543215': [
    {
      name:        "Ammu's Fish Curry Meals",
      description: 'Home-style red fish curry with rice, chammanthi & pickle.',
      pricePaise:  15900, isVeg: false, signature: true,  sortOrder: 1,
      category:    'mains',
      dailyQuantityLimit: 25, dailyQuantityRemaining: 25,
      servingStartMinutes: 12 * 60, servingEndMinutes: 15 * 60,
    },
    {
      name:        'Thatta Idli + Chutney',
      description: 'Thick Malabar-style idli with coconut chutney and sambar.',
      pricePaise:   7500, isVeg: true,  signature: false, sortOrder: 2,
      category:    'breakfast',
      dailyQuantityLimit: 40, dailyQuantityRemaining: 40,
      servingStartMinutes:  7 * 60, servingEndMinutes: 10 * 60 + 30,
    },
    {
      name:        'Chicken Stew + Appam',
      description: 'Light coconut milk chicken stew with two soft appams.',
      pricePaise:  14900, isVeg: false, signature: false, sortOrder: 3,
      category:    'mains',
      dailyQuantityLimit: 30, dailyQuantityRemaining: 30,
      servingStartMinutes: 18 * 60, servingEndMinutes: 21 * 60,
    },
  ],

  '9876543216': [
    {
      name:        'Smoky Beef Shawarma',
      description: 'Grilled beef strips, lavash wrap, garlic sauce. Perinthalmanna classic.',
      pricePaise:  12900, isVeg: false, signature: true,  sortOrder: 1,
      category:    'snacks',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 11 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name:        'Grilled Chicken Platter',
      description: '¼ chicken marinated in Kerala spices, served with raita and bread.',
      pricePaise:  22900, isVeg: false, signature: true,  sortOrder: 2,
      category:    'mains',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 12 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name:        'Grilled Fish Fry',
      description: 'Whole Karimeen (pearl spot) marinated in Malabar spices, grilled to order.',
      pricePaise:  26900, isVeg: false, signature: false, sortOrder: 3,
      category:    'mains',
      dailyQuantityLimit: 30, dailyQuantityRemaining: 30,
      servingStartMinutes: 12 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name:        'Veg Grill Box',
      description: 'Grilled paneer, mushroom & capsicum with garlic bread.',
      pricePaise:  17900, isVeg: true,  signature: false, sortOrder: 4,
      category:    'mains',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 12 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name:        'Chips + Dip Combo',
      description: 'House-made banana chips with tomato chutney dip.',
      pricePaise:   4900, isVeg: true,  signature: false, sortOrder: 5,
      category:    'snacks',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 11 * 60, servingEndMinutes: 22 * 60,
    },
  ],
};

// ─── Seed ───────────���──────────────────────────��─────────────────────────────

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

  // 2. Users
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

  // 3. Address for test customer
  console.log('[seed] address…');
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

  // 4. Link customer default address
  if (customer.defaultAddressId !== address.id) {
    await prisma.user.update({
      where: { id: customer.id },
      data:  { defaultAddressId: address.id },
    });
  }
  console.log('  ✓ customer.defaultAddressId linked');

  // 5. Partners
  console.log('[seed] partners…');
  const partnerById = {};
  for (const p of PARTNERS) {
    const owner = userByPhone[p.phone];
    const partner = await prisma.partner.upsert({
      where:  { userId: owner.id },
      update: {
        brand:         p.brand,
        ownerName:     p.ownerName,
        category:      p.category,
        kycStatus:     'APPROVED',
        isActive:      true,
        zoneCode:      'perinthalmanna',
        commissionBps: p.commissionBps,
        fssaiNumber:   p.fssaiNumber,
      },
      create: {
        userId:        owner.id,
        brand:         p.brand,
        ownerName:     p.ownerName,
        category:      p.category,
        kycStatus:     'APPROVED',
        isActive:      true,
        zoneCode:      'perinthalmanna',
        commissionBps: p.commissionBps,
        fssaiNumber:   p.fssaiNumber,
      },
    });
    partnerById[p.phone] = partner;
    console.log(`    ✓ ${partner.brand}`);
  }

  // 6. Riders
  console.log('[seed] riders…');
  for (const r of RIDERS) {
    const owner = userByPhone[r.phone];
    const rider = await prisma.rider.upsert({
      where:  { userId: owner.id },
      update: {
        fullName:      r.fullName,
        vehicleType:   r.vehicleType,
        vehicleNumber: r.vehicleNumber,
        kycStatus:     'APPROVED',
        isActive:      true,
        isOnline:      false,
        zoneCode:      'perinthalmanna',
      },
      create: {
        userId:        owner.id,
        fullName:      r.fullName,
        vehicleType:   r.vehicleType,
        vehicleNumber: r.vehicleNumber,
        kycStatus:     'APPROVED',
        isActive:      true,
        isOnline:      false,
        zoneCode:      'perinthalmanna',
      },
    });
    console.log(`    ✓ rider ${rider.fullName}`);

    // Rider wallet
    await prisma.wallet.upsert({
      where:  { riderId: rider.id },
      update: { ownerType: 'RIDER', partnerId: null, currency: 'INR' },
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
  }
  console.log(`  ✓ ${RIDERS.length} riders with wallets`);

  // 7. Partner wallets
  console.log('[seed] partner wallets…');
  for (const p of PARTNERS) {
    const partner = partnerById[p.phone];
    await prisma.wallet.upsert({
      where:  { partnerId: partner.id },
      update: { ownerType: 'PARTNER', riderId: null, currency: 'INR' },
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
  }
  console.log('  ✓ partner wallets');

  // 8. Menu items per partner
  console.log('[seed] menu items…');
  let totalItems = 0;
  for (const [phone, menuList] of Object.entries(MENUS)) {
    const partner = partnerById[phone];
    if (!partner) { console.warn(`  ! no partner for phone ${phone} — skipping`); continue; }
    for (const m of menuList) {
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
      totalItems++;
    }
    console.log(`    ✓ ${menuList.length} items for ${partner.brand}`);
  }
  console.log(`  ✓ ${totalItems} menu items total`);

  console.log('[seed] done.');
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
