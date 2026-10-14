import { ApiError } from './errors';

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 1_000_000) throw new ApiError(413, 'Payload too large');
  try { return text ? JSON.parse(text) : {}; } catch { throw new ApiError(400, 'Invalid JSON'); }
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try { return await fn(); }
  catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Request failed.' }, 500);
  }
}
