import { ApiError } from './errors';

export const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers });

const MAX_BODY = 1_000_000;

export async function readJson(req: Request): Promise<unknown> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) throw new ApiError(413, 'Payload too large');
  let text = '';
  if (req.body) {
    if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) throw new ApiError(415, 'Content-Type must be application/json');
    const reader = req.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY) { await reader.cancel(); throw new ApiError(413, 'Payload too large'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  }
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
