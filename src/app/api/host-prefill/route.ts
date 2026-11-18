import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { findProfileByEmail } from '@/lib/users';
export const dynamic = 'force-dynamic';

const tenDigits = (n?: string) => (n ? n.replace(/\D/g, '').slice(-10) : undefined);

/** What the host form can fill in for the signed-in person: their own name and email, and a seller's or admin's public profile. Nothing about anyone else. */
export const GET = () => handle(async () => {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return json({}, 200, { 'cache-control': 'no-store' });
  const out: Record<string, string> = { ...(session.user?.name ? { name: session.user.name } : {}), email };
  if (session.user?.role === 'seller' || session.user?.role === 'admin') {
    const p = await findProfileByEmail(email); // only a real profile: the host name is its display name, never the account name
    const add = (k: string, v?: string) => { if (v) out[k] = v; };
    if (!p) return json(out, 200, { 'cache-control': 'no-store' });
    add('hostName', p.displayName); add('phone', tenDigits(p.publicPhone)); add('whatsapp', tenDigits(p.whatsapp)); add('instagram', p.instagram); add('website', p.website);
  }
  return json(out, 200, { 'cache-control': 'no-store' });
});
