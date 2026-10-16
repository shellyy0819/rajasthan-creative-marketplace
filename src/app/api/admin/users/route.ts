import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { createUser, listUsers } from '@/lib/users';
export const dynamic = 'force-dynamic';
export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await listUsers(), 200, { 'cache-control': 'no-store' });
});
export const POST = (req: Request) => handle(async () => {
  const admin = requireAdmin(await auth());
  return json(await createUser(await readJson(req), admin.email), 201);
});
