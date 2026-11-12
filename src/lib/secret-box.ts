import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** AES-256-GCM with a key derived from NEXTAUTH_SECRET: secrets saved in the database are unreadable without the app's secret. */
function key(): Buffer {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET is not set; cannot protect saved secrets.');
  return createHash('sha256').update(`settings-secret-box:${s}`).digest();
}

/** "v1.iv.tag.ciphertext", each part base64url. */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

/** The original text, or null when the value is malformed or was sealed with a different NEXTAUTH_SECRET. */
export function open(sealed: unknown): string | null {
  if (typeof sealed !== 'string') return null;
  const [v, iv, tag, data] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !data) return null;
  try {
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
  } catch { return null; }
}
