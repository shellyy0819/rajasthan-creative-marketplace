import { json } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function GET() {
  return json({ ok: true, service: 'Rajasthan Creative Marketplace', timestamp: new Date().toISOString() });
}
