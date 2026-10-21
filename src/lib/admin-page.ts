import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { adminGate, staffGate } from './admin-gate';
import { requireStaff, type StaffUser } from './authz';
import { signInUrl } from './hosts';

// Call from BOTH the dashboard layout and every dashboard page: layouts and pages render independently,
// so a page must never rely on the layout alone for access control.
export async function requireAdminPage(): Promise<void> {
  const gate = adminGate(await auth());
  if (gate === 'signin') redirect(signInUrl('/dashboard/posts'));
  if (gate === 'forbidden') notFound();
}

// Admins and sellers. Call from the dashboard layout AND every page (layouts and pages render independently).
export async function requireStaffPage(): Promise<StaffUser> {
  const session = await auth();
  const gate = staffGate(session);
  if (gate === 'signin') redirect(signInUrl('/dashboard/posts'));
  if (gate === 'forbidden') notFound();
  return requireStaff(session);
}
