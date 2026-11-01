import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import { confirmListingRequest } from '@/lib/listing-requests';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** Admin marks a request "confirmed" after verifying the owner by phone. Only that one transition exists. */
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  const admin = requireAdmin(await auth());
  const { id } = await params;
  const body = await readJson(req);
  const status = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>).status : undefined;
  if (status !== 'confirmed') throw new ApiError(400, 'status must be "confirmed".');
  return json(await confirmListingRequest(id, admin.email));
});
