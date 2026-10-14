import { json } from '@/lib/api';
export const dynamic = 'force-dynamic';
const notFound = () => json({ error: 'API route not found.' }, 404);
export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
