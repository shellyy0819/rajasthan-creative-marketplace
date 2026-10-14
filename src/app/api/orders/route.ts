import { revalidatePath } from 'next/cache';
import { handle, json, readJson } from '@/lib/api';
import { createOrder } from '@/lib/orders';
export const dynamic = 'force-dynamic';
export const POST = (req: Request) => handle(async () => {
  const order = await createOrder(await readJson(req));
  revalidatePath('/', 'layout');
  return json(order, 201);
});
