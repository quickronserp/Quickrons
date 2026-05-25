// Seed Forra Foods menu + dev users. Idempotent — safe to re-run.
//
// Run:  npm run seed
//   (or)  node prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MENU = [
  { name: 'Thalassery Chicken Biryani', description: 'Kaima rice, slow-cooked Malabar masala, raita & lemon pickle.', pricePaise: 22900, isVeg: false, signature: true,  sortOrder: 1 },
  { name: 'Beef Fry + Parotta',         description: 'Slow-roasted beef pieces with layered Malabar parotta.',        pricePaise: 18900, isVeg: false, signature: false, sortOrder: 2 },
  { name: 'Kerala Sadhya (Mini)',       description: '12-item banana-leaf veg meal in eco container.',                pricePaise: 19900, isVeg: true,  signature: false, sortOrder: 3 },
  { name: 'Puttu + Kadala Curry',       description: 'Steamed rice puttu with black chana curry. Breakfast staple.',  pricePaise:  7900, isVeg: true,  signature: false, sortOrder: 4 },
  { name: 'Forra Dried Fruits Box',     description: 'Premium dates, almonds, cashews, raisins. 500 g.',              pricePaise: 29900, isVeg: true,  signature: true,  sortOrder: 5 },
];

const USERS = [
  { phone: '9876543210', role: 'CUSTOMER' },
  { phone: '9876543211', role: 'PARTNER'  },
  { phone: '9876543212', role: 'RIDER'    },
];

async function main() {
  console.log('[seed] menu items…');
  for (const m of MENU) {
    // Idempotent upsert by name (no @unique on name — match the first matching row).
    const existing = await prisma.menuItem.findFirst({ where: { name: m.name } });
    if (existing) {
      await prisma.menuItem.update({ where: { id: existing.id }, data: m });
    } else {
      await prisma.menuItem.create({ data: m });
    }
  }
  console.log(`  ✓ ${MENU.length} menu items`);

  console.log('[seed] dev users…');
  for (const u of USERS) {
    await prisma.user.upsert({
      where:  { phone: u.phone },
      update: { role: u.role },
      create: u,
    });
  }
  console.log(`  ✓ ${USERS.length} dev users`);

  console.log('[seed] done.');
}

main()
  .catch(e => { console.error('[seed] failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
