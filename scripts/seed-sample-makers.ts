// Local development only: adds a few invented makers (with one published product each) so the home-page makers carousel has something to show.
// Safe to run twice. Refuses to touch any database that is not on this machine.
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Database } from '../src/db/client';
import { ensureSellerProfile, ensureUser, grantRole } from '../src/db/people';
import { allocateId } from '../src/db/ids';
import * as schema from '../src/db/schema';
import { categories, cities, products, sellerProfiles } from '../src/db/schema';

try { process.loadEnvFile('.env.local'); } catch { /* optional */ }
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set.'); process.exit(1); }
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) { console.error('Refusing to seed: DATABASE_URL is not a local database.'); process.exit(1); }

const SAMPLES = [
  { email: 'meera-blue-pottery@seed.rangrajasthan.invalid', name: 'Meera Blue Pottery House', category: 'Pottery', city: 'Jaipur', bio: 'Every glaze takes three firings and I never hurry the third. Six women work beside me in the courtyard.', product: { name: 'Tulip plate', pricePaise: 85000 }, extra: { name: 'Blue glaze studs', category: 'Accessories', pricePaise: 29000 } },
  { email: 'kavita-lac-bangles@seed.rangrajasthan.invalid', name: 'Kavita Lac Bangles', category: 'Accessories', city: 'Jaipur', bio: 'Each bangle is warmed, twisted and set with tiny mirrors by hand.', product: { name: 'Mirror bangle pair', pricePaise: 35000 }, extra: { name: 'Resin charm bangle', category: 'Resin Art', pricePaise: 42000 } },
  { email: 'udaipur-resin-studio@seed.rangrajasthan.invalid', name: 'Udaipur Resin Studio', category: 'Resin Art', city: 'Udaipur', bio: 'Pressed flowers and gold leaf, set in clear resin one piece at a time.', product: { name: 'Flower pendant', pricePaise: 45000 } },
  { email: 'lakshmi-bandhani@seed.rangrajasthan.invalid', name: 'Lakshmi Bandhani', category: 'Crochet & Textiles', city: 'Jodhpur', bio: 'Bandhani is a thousand knots tied with fingernails and love.', product: { name: 'Bandhani dupatta', pricePaise: 140000 }, extra: { name: 'Knotted pouch', category: 'Accessories', pricePaise: 39000 } },
] as const;

async function main() {
  const client = postgres(url!, { max: 1, connect_timeout: 10 });
  const db = drizzle(client, { schema }) as unknown as Database;
  try {
    for (const s of SAMPLES) {
      await db.transaction(async tx => {
        const u = await ensureUser(tx, s.email, s.name);
        const [city] = await tx.select().from(cities).where(eq(cities.name, s.city)).limit(1);
        const [cat] = await tx.select().from(categories).where(eq(categories.name, s.category)).limit(1);
        if (!city || !cat) { console.log(`Skipped ${s.name}: city "${s.city}" or category "${s.category}" is missing locally.`); return; }
        await grantRole(tx, u.id, 'seller');
        await ensureSellerProfile(tx, u.id, s.name);
        await tx.update(sellerProfiles).set({ displayName: s.name, category: s.category, bio: s.bio, cityId: city.id }).where(eq(sellerProfiles.userId, u.id));
        const [has] = await tx.select({ n: sql<number>`count(*)::int` }).from(products).where(eq(products.sellerId, u.id));
        if ('extra' in s && has.n < 2) {
          await tx.insert(products).values({ id: await allocateId(tx, 'p'), name: s.extra.name, category: s.extra.category, cityId: city.id, pricePaise: s.extra.pricePaise, description: `${s.extra.name} by ${s.name} (sample).`, stock: 5, status: 'APPROVED', sellerId: u.id });
        }
        if (has.n === 0) {
          await tx.insert(products).values({ id: await allocateId(tx, 'p'), name: s.product.name, category: s.category, cityId: city.id, pricePaise: s.product.pricePaise, description: `${s.product.name} by ${s.name} (sample).`, stock: 5, status: 'APPROVED', sellerId: u.id });
        }
        console.log(`Ready: ${s.name}`);
      });
    }
  } finally { await client.end(); }
}
void main();
