import type { Actor } from '@/lib/authz';
export const admin: Actor = { email: 'root@x.co', role: 'admin' };
export const seller: Actor = { email: 'seller@x.co', role: 'seller' };
export const seller2: Actor = { email: 'other@x.co', role: 'seller' };
