import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireUser } from '@/lib/authz';
import { createOrder, listOrders } from '@/lib/orders';
export const dynamic = 'force-dynamic';
export const GET = () => handle(async () => json(await listOrders(requireUser(await auth()))));
export const POST = (req: Request) => handle(async () => {
  const user = requireUser(await auth());
  const order = await createOrder(await readJson(req), user.email);
  revalidatePath('/', 'layout');
  return json(order, 201);
});
