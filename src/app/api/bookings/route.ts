import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireUser } from '@/lib/authz';
import { notifyBooking } from '@/lib/booking-notify';
import { createBooking, listBookings } from '@/lib/orders';
export const dynamic = 'force-dynamic';
export const GET = () => handle(async () => json(await listBookings(requireUser(await auth()))));
export const POST = (req: Request) => handle(async () => {
  const user = requireUser(await auth());
  const booking = await createBooking(await readJson(req), user.email);
  revalidatePath('/', 'layout');
  await notifyBooking(booking, user.email); // best effort: the booking is saved either way
  return json(booking, 201);
});
