import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import { sendMail } from '@/lib/mailer';
import { assertEmail } from '@/lib/settings';
import { obj } from '@/lib/validate';
export const dynamic = 'force-dynamic';

/** Sends a test message with the settings in use, to the address typed (default: the admin's own), and reports Resend's answer. */
export const POST = (req: Request) => handle(async () => {
  const admin = requireAdmin(await auth());
  const raw = obj(await readJson(req));
  const to = assertEmail(raw.to ?? admin.email);
  try {
    await sendMail({ to, subject: 'Craftofy test email', text: 'This is a test email from the Craftofy admin settings. Email is working.\n' });
  } catch (e) {
    throw new ApiError(502, e instanceof Error ? e.message : 'Could not send the test email.'); // admins may see the provider's reason
  }
  return json({ ok: true, to });
});
