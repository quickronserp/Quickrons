// Quickrons — Phase 2 MVP seed
//
// Idempotent. Safe to re-run.
//
// Partner login phones (must match exactly):
//   Fathima's Kitchen          → 9876543211
//   Malabar Hotel              → 9876543221
//   Ammu's Homely Meals        → 9876543222
//   Forra Foods                → 9876543223  (healthy/gym/wellness flagship)
//   Perinthalmanna Grill House → 9876543224
//
// Partner upsert strategy: find by `brand` (unique in dev), then update
// `userId` + all other fields. This correctly re-links the Partner row even
// if the owner phone changed between seed runs (avoids orphaned rows).
//
// Riders: Rajan K (9876543212), Shafi P (9876543217), Navas M (9876543218)
//
// Run:  npm run seed   (or)   node prisma/seed.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── Zones ────────────────────────────────────────────────────────────────────

const ZONES = [
  {
    code:       'perinthalmanna',
    nameEn:     'Perinthalmanna',
    nameMl:     'പെരിന്തൽമണ്ണ',
    district:   'Malappuram',
    pincodes:   ['679322', '679323', '679325', '679340'],
    isActive:   true,
    centerLat:  '10.9760000',
    centerLng:  '76.2270000',
    radiusKm:   '6.00',
    launchedAt: new Date(),
  },
];

// ─── Users ────────────────────────────────────────────────────────────────────
// Every partner and rider needs a User row whose phone is the login phone.
// Upsert key: phone (unique on User table).

const USERS = [
  // Customer
  { phone: '9876543210', name: 'Test Customer',              role: 'CUSTOMER' },
  // Partners — phones MUST match the required login phones below
  { phone: '9876543211', name: 'Fathima',                    role: 'PARTNER'  },
  { phone: '9876543221', name: 'Malabar Hotel Owner',        role: 'PARTNER'  },
  { phone: '9876543222', name: 'Ammu',                       role: 'PARTNER'  },
  { phone: '9876543223', name: 'Forra Foods Manager',        role: 'PARTNER'  },
  { phone: '9876543224', name: 'Grill House Manager',        role: 'PARTNER'  },
  // Riders
  { phone: '9876543212', name: 'Rajan K',                    role: 'RIDER'    },
  { phone: '9876543217', name: 'Shafi P',                    role: 'RIDER'    },
  { phone: '9876543218', name: 'Navas M',                    role: 'RIDER'    },
  // Admin
  { phone: '9876543219', name: 'Quickrons Admin',            role: 'ADMIN'    },
];

// ─── Partners ─────────────────────────────────────────────────────────────────
// `phone` must match the USERS entry above — used to look up the User.id.
// `brand` is used as the find-by key for upsert (unique in dev).

// Demo imagery (Unsplash, stable photo IDs). Gives the founder demo a populated
// storefront without anyone having to upload by hand. Real uploads via the
// partner app overwrite these. `tagline` shows under the brand on the feed.
const IMG = (id, w = 1200) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

const PARTNERS = [
  {
    phone:         '9876543211',
    brand:         "Fathima's Kitchen",
    ownerName:     'Fathima',
    category:      'HOME_MAKER',
    commissionBps: 1000,
    fssaiNumber:   'FSSAI-DEV-FATHIMA',
    tagline:       'Authentic Malabar home cooking',
    bannerImageUrl: IMG('photo-1585937421612-70a008356fbe'),
    profileImageUrl: IMG('photo-1556909212-d5b604d0c90d', 400),
  },
  {
    phone:         '9876543221',
    brand:         'Malabar Hotel',
    ownerName:     'Basheer',
    category:      'RESTAURANT',
    commissionBps: 1500,
    fssaiNumber:   'FSSAI-DEV-MALABAR',
    tagline:       'Classic Kerala hotel-style meals',
    bannerImageUrl: IMG('photo-1517248135467-4c7edcad34c4'),
    profileImageUrl: IMG('photo-1414235077428-338989a2e8c0', 400),
  },
  {
    phone:         '9876543222',
    brand:         "Ammu's Homely Meals",
    ownerName:     'Ammu',
    category:      'HOME_MAKER',
    commissionBps: 1000,
    fssaiNumber:   'FSSAI-DEV-AMMU',
    tagline:       'Comforting home-style lunch & dinner',
    bannerImageUrl: IMG('photo-1567188040759-fb8a883dc6d8'),
    profileImageUrl: IMG('photo-1466637574441-749b8f19452f', 400),
  },
  {
    phone:         '9876543223',
    brand:         'Forra Foods',
    ownerName:     'Forra Foods Manager',
    // FORRA_SUPPLIER positions this partner as the Quickrons flagship —
    // healthy Kerala foods, high-protein bowls, gym/wellness nutrition.
    category:      'FORRA_SUPPLIER',
    commissionBps: 1200,
    fssaiNumber:   'FSSAI-DEV-FORRA',
    tagline:       'High-protein, gym-friendly Kerala nutrition',
    bannerImageUrl: IMG('photo-1512621776951-a57141f2eefd'),
    profileImageUrl: IMG('photo-1490645935967-10de6ba17061', 400),
  },
  {
    phone:         '9876543224',
    brand:         'Perinthalmanna Grill House',
    ownerName:     'Grill House Manager',
    category:      'RESTAURANT',
    commissionBps: 1500,
    fssaiNumber:   'FSSAI-DEV-GRILL',
    tagline:       'Charcoal grills, shawarma & BBQ',
    bannerImageUrl: IMG('photo-1599487488170-d11ec9c172f0'),
    profileImageUrl: IMG('photo-1529193591184-b1d58069ecdd', 400),
  },
];

// Per-category dish photos — applied to any seeded menu item lacking an explicit
// imageUrl. Keyed by the item's `category` string.
const DISH_IMAGE_BY_CATEGORY = {
  biryani:   IMG('photo-1563379091339-03b21ab4a4f8', 600),
  mains:     IMG('photo-1631452180519-c014fe946bc7', 600),
  breakfast: IMG('photo-1630383249896-424e482df921', 600),
  snacks:    IMG('photo-1601050690597-df0568f70950', 600),
  healthy:   IMG('photo-1512621776951-a57141f2eefd', 600),
  wellness:  IMG('photo-1490645935967-10de6ba17061', 600),
  catering:  IMG('photo-1555244162-803834f70033', 600),
};
const DISH_IMAGE_DEFAULT = IMG('photo-1504674900247-0877df9cc836', 600);

function dishImage(item) {
  return item.imageUrl || DISH_IMAGE_BY_CATEGORY[item.category] || DISH_IMAGE_DEFAULT;
}

// ─── Riders ───────────────────────────────────────────────────────────────────

const RIDERS = [
  { phone: '9876543212', fullName: 'Rajan K',  vehicleType: 'BIKE', vehicleNumber: 'KL-55-AB-2421' },
  { phone: '9876543217', fullName: 'Shafi P',  vehicleType: 'BIKE', vehicleNumber: 'KL-10-CJ-5533' },
  { phone: '9876543218', fullName: 'Navas M',  vehicleType: 'AUTO', vehicleNumber: 'KL-55-BZ-7890' },
];

// ─── Menus — keyed by partner phone ──────────────────────────────────────────

const MENUS = {
  // Fathima's Kitchen
  '9876543211': [
    {
      name: 'Thalassery Chicken Biryani',
      description: 'Kaima rice, slow-cooked Malabar masala, raita & lemon pickle.',
      pricePaise: 22900, isVeg: false, signature: true,  sortOrder: 1,
      category: 'biryani',
      dailyQuantityLimit: 40, dailyQuantityRemaining: 40,
      servingStartMinutes: 11 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Beef Fry + Parotta',
      description: 'Slow-roasted beef pieces with two layered Malabar parottas.',
      pricePaise: 18900, isVeg: false, signature: false, sortOrder: 2,
      category: 'mains',
      dailyQuantityLimit: 60, dailyQuantityRemaining: 60,
      servingStartMinutes: 12 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Kerala Sadhya (Mini)',
      description: '12-item banana-leaf veg meal in eco-friendly container.',
      pricePaise: 19900, isVeg: true, signature: false, sortOrder: 3,
      category: 'mains',
      dailyQuantityLimit: 30, dailyQuantityRemaining: 30,
      servingStartMinutes: 12 * 60, servingEndMinutes: 15 * 60,
    },
    {
      name: 'Puttu + Kadala Curry',
      description: 'Steamed rice puttu with black chana curry. Breakfast staple.',
      pricePaise: 7900, isVeg: true, signature: false, sortOrder: 4,
      category: 'breakfast',
      dailyQuantityLimit: 80, dailyQuantityRemaining: 80,
      servingStartMinutes: 7 * 60, servingEndMinutes: 10 * 60 + 30,
    },
    {
      name: 'Malabar Fish Curry Meals',
      description: 'Red fish curry, rice, thoran, pappadam — daily fresh.',
      pricePaise: 16900, isVeg: false, signature: true, sortOrder: 5,
      category: 'mains',
      dailyQuantityLimit: 40, dailyQuantityRemaining: 40,
      servingStartMinutes: 12 * 60, servingEndMinutes: 15 * 60,
    },
  ],

  // Malabar Hotel
  '9876543221': [
    {
      name: 'Malabar Chicken Curry Meals',
      description: 'Fragrant chicken curry, steamed rice, papad & pickle. Hotel-style plate.',
      pricePaise: 17900, isVeg: false, signature: true, sortOrder: 1,
      category: 'mains',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 11 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Mutton Biryani (Hotel Style)',
      description: 'Dum-cooked mutton biryani with hotel gravy & raita.',
      pricePaise: 27900, isVeg: false, signature: true, sortOrder: 2,
      category: 'biryani',
      dailyQuantityLimit: 50, dailyQuantityRemaining: 50,
      servingStartMinutes: 12 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Porotta + Chicken Roast',
      description: 'Crispy-layered Malabar porotta with spicy dry chicken roast.',
      pricePaise: 17900, isVeg: false, signature: false, sortOrder: 3,
      category: 'mains',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 11 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Veg Meals',
      description: 'Rice, sambar, avial, thoran, pickle & papad.',
      pricePaise: 10900, isVeg: true, signature: false, sortOrder: 4,
      category: 'mains',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 11 * 60, servingEndMinutes: 15 * 60,
    },
    {
      name: 'Idiyappam + Egg Curry',
      description: 'Soft rice noodles with creamy coconut egg curry.',
      pricePaise: 9900, isVeg: false, signature: false, sortOrder: 5,
      category: 'breakfast',
      dailyQuantityLimit: 60, dailyQuantityRemaining: 60,
      servingStartMinutes: 7 * 60, servingEndMinutes: 11 * 60,
    },
  ],

  // Ammu's Homely Meals
  '9876543222': [
    {
      name: "Ammu's Fish Curry Meals",
      description: 'Home-style red fish curry with rice, chammanthi & pickle.',
      pricePaise: 15900, isVeg: false, signature: true, sortOrder: 1,
      category: 'mains',
      dailyQuantityLimit: 25, dailyQuantityRemaining: 25,
      servingStartMinutes: 12 * 60, servingEndMinutes: 15 * 60,
    },
    {
      name: 'Thatta Idli + Chutney',
      description: 'Thick Malabar-style idli with coconut chutney and sambar.',
      pricePaise: 7500, isVeg: true, signature: false, sortOrder: 2,
      category: 'breakfast',
      dailyQuantityLimit: 40, dailyQuantityRemaining: 40,
      servingStartMinutes: 7 * 60, servingEndMinutes: 10 * 60 + 30,
    },
    {
      name: 'Chicken Stew + Appam',
      description: 'Light coconut milk chicken stew with two soft appams.',
      pricePaise: 14900, isVeg: false, signature: false, sortOrder: 3,
      category: 'mains',
      dailyQuantityLimit: 30, dailyQuantityRemaining: 30,
      servingStartMinutes: 18 * 60, servingEndMinutes: 21 * 60,
    },
  ],

  // Forra Foods — Quickrons flagship: healthy Kerala foods, gym/wellness nutrition.
  // Positioned for fitness-conscious users + traditional wellness seekers.
  '9876543223': [
    {
      name: 'Dumbbell Chicken & Rice',
      description: 'Grilled lean chicken (180g), brown kaima rice, sautéed greens. ~45g protein. Built for gym days.',
      pricePaise: 24900, isVeg: false, signature: true, sortOrder: 1,
      category: 'healthy',
      dailyQuantityLimit: 50, dailyQuantityRemaining: 50,
      servingStartMinutes: 6 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Sprouted Ragi Powder',
      description: 'Stone-ground Kerala ragi, sprouted & sun-dried. 500g pack. High calcium & iron. For kanji, dosa, baby food.',
      pricePaise: 18900, isVeg: true, signature: true, sortOrder: 2,
      category: 'wellness',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 6 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Kerala Protein Kanji Mix',
      description: 'Traditional njavara + green gram + groundnut blend. ~22g protein per serving. Authentic recovery food.',
      pricePaise: 21900, isVeg: true, signature: false, sortOrder: 3,
      category: 'wellness',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 6 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'High Protein Puttu Mix',
      description: 'Red rice + soya + roasted gram puttu mix. 600g pack. ~18g protein per puttu serving.',
      pricePaise: 16900, isVeg: true, signature: false, sortOrder: 4,
      category: 'wellness',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 6 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Banana Peanut Smoothie Mix',
      description: 'Kerala nendran banana powder + peanut + dates. Just add milk. ~14g protein, no added sugar.',
      pricePaise: 14900, isVeg: true, signature: false, sortOrder: 5,
      category: 'wellness',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 6 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Healthy Meal Combo',
      description: 'Brown rice, grilled fish, avial, beetroot thoran, butter milk. Balanced 650 kcal Kerala plate.',
      pricePaise: 22900, isVeg: false, signature: true, sortOrder: 6,
      category: 'healthy',
      dailyQuantityLimit: 40, dailyQuantityRemaining: 40,
      servingStartMinutes: 11 * 60, servingEndMinutes: 15 * 60,
    },
    {
      name: 'Gym Meal Chicken Bowl',
      description: 'Shredded grilled chicken (200g), quinoa, steamed broccoli, boiled egg. ~55g protein, 580 kcal.',
      pricePaise: 27900, isVeg: false, signature: true, sortOrder: 7,
      category: 'healthy',
      dailyQuantityLimit: 35, dailyQuantityRemaining: 35,
      servingStartMinutes: 6 * 60, servingEndMinutes: 22 * 60,
    },
  ],

  // Perinthalmanna Grill House
  '9876543224': [
    {
      name: 'Smoky Beef Shawarma',
      description: 'Grilled beef strips, lavash wrap, garlic sauce. Perinthalmanna classic.',
      pricePaise: 12900, isVeg: false, signature: true, sortOrder: 1,
      category: 'snacks',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 11 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Grilled Chicken Platter',
      description: '¼ chicken marinated in Kerala spices, served with raita and bread.',
      pricePaise: 22900, isVeg: false, signature: true, sortOrder: 2,
      category: 'mains',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 12 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Grilled Fish Fry',
      description: 'Whole Karimeen (pearl spot) marinated in Malabar spices, grilled to order.',
      pricePaise: 26900, isVeg: false, signature: false, sortOrder: 3,
      category: 'mains',
      dailyQuantityLimit: 30, dailyQuantityRemaining: 30,
      servingStartMinutes: 12 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Veg Grill Box',
      description: 'Grilled paneer, mushroom & capsicum with garlic bread.',
      pricePaise: 17900, isVeg: true, signature: false, sortOrder: 4,
      category: 'mains',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 12 * 60, servingEndMinutes: 22 * 60,
    },
    {
      name: 'Chips + Dip Combo',
      description: 'House-made banana chips with tomato chutney dip.',
      pricePaise: 4900, isVeg: true, signature: false, sortOrder: 5,
      category: 'snacks',
      dailyQuantityLimit: null, dailyQuantityRemaining: null,
      servingStartMinutes: 11 * 60, servingEndMinutes: 22 * 60,
    },
  ],
};

// ─── Seed ─────────────────────────────────────────────────────────────────────

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

  // 2. Users — upsert by phone
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

  if (customer.defaultAddressId !== address.id) {
    await prisma.user.update({
      where: { id: customer.id },
      data:  { defaultAddressId: address.id },
    });
  }
  console.log(`  ✓ address ${address.id} linked to customer`);

  // 4. Partners
  // ── Upsert strategy ────────────────────────────────────────────────────────
  // We look up the Partner by `brand` (naturally unique in dev) rather than
  // by `userId`. This lets us update the `userId` field if the owner phone
  // changed between seed runs (e.g. 9876543213 → 9876543221), preventing the
  // "no partner profile linked" error on the PARTNER login flow.
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[seed] partners…');
  const partnerByPhone = {};

  for (const p of PARTNERS) {
    const owner = userByPhone[p.phone];

    const partnerData = {
      userId:        owner.id,        // ← re-links to correct User on every run
      brand:         p.brand,
      ownerName:     p.ownerName,
      category:      p.category,
      kycStatus:     'APPROVED',
      isActive:      true,
      zoneCode:      'perinthalmanna',
      commissionBps: p.commissionBps,
      fssaiNumber:   p.fssaiNumber,
      tagline:        p.tagline || null,
      bannerImageUrl: p.bannerImageUrl || null,
      profileImageUrl: p.profileImageUrl || null,
    };

    // Find existing partner by brand first, then by userId. The userId
    // fallback matters when the seed renames a brand (e.g. "Forra Catering"
    // → "Forra Foods"): brand lookup misses, but userId is @unique so we
    // must update the existing row instead of creating a duplicate.
    const existing =
      (await prisma.partner.findFirst({ where: { brand: p.brand } })) ||
      (await prisma.partner.findUnique({ where: { userId: owner.id } }));

    let partner;
    if (existing) {
      partner = await prisma.partner.update({
        where: { id: existing.id },
        data:  partnerData,
      });
    } else {
      partner = await prisma.partner.create({ data: partnerData });
    }

    partnerByPhone[p.phone] = partner;
    console.log(`    ✓ ${partner.brand}  (userId=${owner.id}  phone=${p.phone})`);
  }

  // 5. Riders
  console.log('[seed] riders…');
  for (const r of RIDERS) {
    const owner = userByPhone[r.phone];

    const riderData = {
      userId:        owner.id,
      fullName:      r.fullName,
      vehicleType:   r.vehicleType,
      vehicleNumber: r.vehicleNumber,
      kycStatus:     'APPROVED',
      isActive:      true,
      isOnline:      false,
      zoneCode:      'perinthalmanna',
    };

    // Rider upsert is keyed by userId — phones haven't changed for riders.
    const rider = await prisma.rider.upsert({
      where:  { userId: owner.id },
      update: riderData,
      create: riderData,
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

  // 6. Partner wallets
  console.log('[seed] partner wallets…');
  for (const p of PARTNERS) {
    const partner = partnerByPhone[p.phone];
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

  // 7. Menu items — find by (partnerId, name), update or create.
  // After each partner's menu is upserted, deactivate any of their *other*
  // still-active items that aren't in the new list. This keeps the seed
  // idempotent across rebrands (e.g. Forra Catering → Forra Foods, where
  // the old catering items must disappear from the storefront).
  // Soft-delete only — hard delete is blocked by Order/OrderItem FKs.
  console.log('[seed] menu items…');
  let totalItems = 0;
  for (const [phone, menuList] of Object.entries(MENUS)) {
    const partner = partnerByPhone[phone];
    if (!partner) { console.warn(`  ! no partner for phone ${phone} — skipping`); continue; }

    const keepNames = new Set();
    for (const m of menuList) {
      keepNames.add(m.name);
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
        imageUrl:               dishImage(m),
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

    const stale = await prisma.menuItem.updateMany({
      where: {
        partnerId: partner.id,
        active:    true,
        name:      { notIn: Array.from(keepNames) },
      },
      data: { active: false },
    });
    const staleSuffix = stale.count > 0 ? `  (deactivated ${stale.count} stale)` : '';
    console.log(`    ✓ ${menuList.length} items for ${partner.brand}${staleSuffix}`);
  }
  console.log(`  ✓ ${totalItems} menu items total`);

  // 8. Verify — print partner → phone mapping for confirmation
  console.log('\n[seed] ── Partner login verification ──────────────────────────────');
  for (const p of PARTNERS) {
    const owner   = userByPhone[p.phone];
    const partner = partnerByPhone[p.phone];
    // Re-fetch to confirm userId linkage is correct in DB
    const dbPartner = await prisma.partner.findUnique({
      where:  { id: partner.id },
      select: { id: true, brand: true, userId: true, isActive: true, kycStatus: true },
    });
    const linked = dbPartner.userId === owner.id ? '✓ LINKED' : '✗ MISMATCH';
    console.log(`  ${linked}  ${dbPartner.brand.padEnd(30)} login=${p.phone}  userId=${owner.id}`);
  }

  console.log('\n[seed] done.');
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
