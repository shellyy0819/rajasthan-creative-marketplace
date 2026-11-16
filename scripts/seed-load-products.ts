// Local development only: gives sample products big photos (public/dev-dummy, 4 to 5 MB each) and adds 50 more sample products,
// so the home shelf's paging and photo loading can be tested. Every photo url is unique (?i=<product id>) so the browser cannot cache one copy.
//   npx tsx scripts/seed-load-products.ts            add the photos and the products (safe to run twice)
//   npx tsx scripts/seed-load-products.ts --remove   delete the load-test products again (photos on other products stay)
import { and, eq, like, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Database } from '../src/db/client';
import { allocateId } from '../src/db/ids';
import * as schema from '../src/db/schema';
import { categories, cities, productImages, products, userRoles, users } from '../src/db/schema';

try { process.loadEnvFile('.env.local'); } catch { /* optional */ }
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set.'); process.exit(1); }
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error('Refusing to seed: DATABASE_URL is not a local database.'); process.exit(1); }

const TAG = '(load-test sample)';
const COUNT = 50;
const PHOTOS = ['terracotta', 'indigo', 'mustard', 'sage', 'rose', 'wood'];
const NAMES: Record<string, string[]> = {
  Pottery: ['Blue glaze bowl', 'Hand-thrown mug', 'Terracotta planter', 'Tulip plate', 'Serving platter', 'Bud vase', 'Tea light holder', 'Soap dish'],
  Accessories: ['Mirror bangle pair', 'Embroidered pouch', 'Beaded keychain', 'Block-print scarf', 'Kundan studs', 'Tassel earrings', 'Jute tote', 'Hair clip set'],
  'Resin Art': ['Pressed flower pendant', 'Coaster set of 4', 'Ocean tray', 'Gold leaf bookmark', 'Fridge magnet pair', 'Trinket dish', 'Tiny frame', 'Charm bangle'],
  'Crochet & Textiles': ['Bandhani dupatta', 'Crochet flower bouquet', 'Cushion cover', 'Table runner', 'Baby booties', 'Wall hanging', 'Granny-square bag', 'Cotton stole'],
};
const CITIES = ['Jaipur', 'Jodhpur', 'Udaipur'];

async function main() {
  const client = postgres(url!, { max: 1, connect_timeout: 10 });
  const db = drizzle(client, { schema }) as unknown as Database;
  try {
    if (process.argv.includes('--remove')) {
      const gone = await db.delete(products).where(like(products.description, `%${TAG}`)).returning({ id: products.id });
      console.log(`Removed ${gone.length} load-test products.`);
      return;
    }
    const cats = await db.select({ name: categories.name }).from(categories);
    const cityRows = await db.select().from(cities);
    const sellers = await db.select({ id: users.id }).from(users).innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(and(eq(users.active, true), eq(userRoles.roleId, 1)));
    if (!cats.length || !cityRows.length || !sellers.length) { console.error('Needs at least one category, city and seller in the local database.'); process.exit(1); }

    // 1. Photos for every sample product that has none.
    const bare = await db.select({ id: products.id }).from(products)
      .where(and(sql`(${products.description} like '%(sample).' or ${products.description} like ${'%' + TAG})`, sql`not exists (select 1 from product_images pim where pim.product_id = ${products.id})`));
    let n = 0;
    for (const p of bare) { await db.insert(productImages).values({ productId: p.id, url: `/dev-dummy/${PHOTOS[n++ % PHOTOS.length]}.jpg?i=${p.id}`, position: 0 }); }
    console.log(`Gave photos to ${bare.length} products.`);

    // 2. More products, up to COUNT load-test ones in total.
    const [{ have }] = await db.select({ have: sql<number>`count(*)::int` }).from(products).where(like(products.description, `%${TAG}`));
    for (let i = have; i < COUNT; i++) {
      const category = NAMES[cats[i % cats.length].name] ? cats[i % cats.length].name : Object.keys(NAMES)[i % 4];
      if (!cats.some(c => c.name === category)) continue;
      const city = cityRows.find(c => c.name === CITIES[i % CITIES.length]) ?? cityRows[0];
      const list = NAMES[category];
      const name = `${list[Math.floor(i / 4) % list.length]} ${String(i + 1).padStart(2, '0')}`;
      await db.transaction(async tx => {
        const id = await allocateId(tx, 'p');
        await tx.insert(products).values({ id, name, category, cityId: city.id, pricePaise: (200 + ((i * 137) % 2800)) * 100, description: `${name} ${TAG}`, stock: 3 + (i % 7), status: 'APPROVED', sellerId: sellers[i % sellers.length].id });
        await tx.insert(productImages).values({ productId: id, url: `/dev-dummy/${PHOTOS[i % PHOTOS.length]}.jpg?i=${id}`, position: 0 });
      });
    }
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(products).where(eq(products.status, 'APPROVED'));
    console.log(`Load-test products: ${COUNT}. Published products in total: ${total}.`);
  } finally { await client.end(); }
}
void main();
