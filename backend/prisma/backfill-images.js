// backfill-images.js — additive, idempotent demo-image backfill.
//
// Sets banner/profile photos on partners and a photo on menu items that
// currently have NONE. It never overwrites an existing image and never
// deletes anything, so it is safe to run against a shared demo database
// (including one partners have already customised via the app).
//
//   node prisma/backfill-images.js
//
// Real uploads always win — this only fills the gaps so the founder demo
// doesn't show empty placeholders on kitchens nobody has photographed yet.

const prisma = require('../src/prisma');

const IMG = (id, w = 1200) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

// Banner/profile keyed by brand (falls back to a generic pair).
const BRAND_IMAGES = {
  "Fathima's Kitchen":           { banner: IMG('photo-1585937421612-70a008356fbe'), profile: IMG('photo-1556909212-d5b604d0c90d', 400) },
  'Malabar Hotel':               { banner: IMG('photo-1517248135467-4c7edcad34c4'), profile: IMG('photo-1414235077428-338989a2e8c0', 400) },
  "Ammu's Homely Meals":         { banner: IMG('photo-1567188040759-fb8a883dc6d8'), profile: IMG('photo-1466637574441-749b8f19452f', 400) },
  'Forra Foods':                 { banner: IMG('photo-1512621776951-a57141f2eefd'), profile: IMG('photo-1490645935967-10de6ba17061', 400) },
  'Perinthalmanna Grill House':  { banner: IMG('photo-1599487488170-d11ec9c172f0'), profile: IMG('photo-1529193591184-b1d58069ecdd', 400) },
};
const GENERIC = { banner: IMG('photo-1504674900247-0877df9cc836'), profile: IMG('photo-1466637574441-749b8f19452f', 400) };

const DISH_IMAGE_BY_CATEGORY = {
  biryani:   IMG('photo-1563379091339-03b21ab4a4f8', 600),
  mains:     IMG('photo-1631452180519-c014fe946bc7', 600),
  breakfast: IMG('photo-1630383249896-424e482df921', 600),
  snacks:    IMG('photo-1601050690597-df0568f70950', 600),
  healthy:   IMG('photo-1512621776951-a57141f2eefd', 600),
  wellness:  IMG('photo-1490645935967-10de6ba17061', 600),
  catering:  IMG('photo-1555244162-803834f70033', 600),
};
const DISH_DEFAULT = IMG('photo-1504674900247-0877df9cc836', 600);

async function main() {
  let partnersFixed = 0;
  let itemsFixed = 0;

  const partners = await prisma.partner.findMany({
    select: { id: true, brand: true, bannerImageUrl: true, profileImageUrl: true },
  });

  for (const p of partners) {
    const imgs = BRAND_IMAGES[p.brand] || GENERIC;
    const data = {};
    if (!p.bannerImageUrl)  data.bannerImageUrl  = imgs.banner;
    if (!p.profileImageUrl) data.profileImageUrl = imgs.profile;
    if (Object.keys(data).length) {
      await prisma.partner.update({ where: { id: p.id }, data });
      partnersFixed++;
      console.log(`  ✓ partner "${p.brand}" ${Object.keys(data).join(', ')}`);
    }
  }

  const items = await prisma.menuItem.findMany({
    where: { OR: [{ imageUrl: null }, { imageUrl: '' }] },
    select: { id: true, name: true, category: true },
  });
  for (const it of items) {
    const url = DISH_IMAGE_BY_CATEGORY[it.category] || DISH_DEFAULT;
    await prisma.menuItem.update({ where: { id: it.id }, data: { imageUrl: url } });
    itemsFixed++;
  }

  console.log(`\n[backfill] partners updated: ${partnersFixed}, menu items updated: ${itemsFixed}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
