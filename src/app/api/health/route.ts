import { sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { json } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
  } catch (err) {
    console.error('health check: database unavailable', err);
    return json({ ok: false, db: false, error: 'Database unavailable.' }, 503);
  }
  return json({ ok: true, db: true, service: 'Craftology', timestamp: new Date().toISOString() });
}
