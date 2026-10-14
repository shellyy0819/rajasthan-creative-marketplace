import { revalidatePath } from 'next/cache';
import { handle, json, readJson } from '@/lib/api';
import { createBooking } from '@/lib/orders';
export const dynamic = 'force-dynamic';
export const POST = (req: Request) => handle(async () => {
  const booking = await createBooking(await readJson(req));
  revalidatePath('/', 'layout');
  return json(booking, 201);
});
