import { handle, json } from '@/lib/api';
import { listSourcingTypes } from '@/lib/sourcing-types';
export const dynamic = 'force-dynamic';

/** Public: the active sourcing types in the admin's order (for product forms and the shop filter). */
export const GET = () => handle(async () => json(await listSourcingTypes()));
