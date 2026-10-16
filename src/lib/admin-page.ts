import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { adminGate, staffGate } from './admin-gate';
import { requireStaff, type StaffUser } from './authz';

// Call from BOTH the admin layout and every admin page: layouts and pages render independently,
// so a page must never rely on the layout alone for access control.
export async function requireAdminPage(): Promise<void> {
  const gate = adminGate(await auth());
  if (gate === 'signin') redirect('/api/auth/signin?callbackUrl=%2Fadmin%2Fposts');
  if (gate === 'forbidden') notFound();
}

// Admins and sellers. Call from the admin layout AND every page (layouts and pages render independently).
export async function requireStaffPage(): Promise<StaffUser> {
  const session = await auth();
  const gate = staffGate(session);
  if (gate === 'signin') redirect('/api/auth/signin?callbackUrl=%2Fadmin%2Fposts');
  if (gate === 'forbidden') notFound();
  return requireStaff(session);
}
