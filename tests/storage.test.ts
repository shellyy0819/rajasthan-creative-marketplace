import { describe, it, expect, vi } from 'vitest';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, deleteObjects, keyFromUrl, newProductKey, presignProductUpload, publicUrlFor, storageConfig, type StorageConfig } from '@/lib/storage';

const REQUIRED = { S3_BUCKET: 'b', S3_REGION: 'ap-south-1', AWS_ACCESS_KEY_ID: 'AKIAFAKE', AWS_SECRET_ACCESS_KEY: 'secret' };
const cfg: StorageConfig = { bucket: 'b', region: 'ap-south-1', publicBase: 'https://b.s3.ap-south-1.amazonaws.com', keyPrefix: '' };
const devCfg: StorageConfig = { ...cfg, keyPrefix: 'dev/' };

describe('constants', () => {
  it('match the agreed limits', () => {
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_IMAGES).toBe(6);
    expect(IMAGE_TYPES).toEqual({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' });
  });
});

describe('storageConfig', () => {
  it('is null unless all four required variables are set and non-blank', () => {
    expect(storageConfig({})).toBeNull();
    for (const k of Object.keys(REQUIRED)) {
      expect(storageConfig({ ...REQUIRED, [k]: undefined })).toBeNull();
      expect(storageConfig({ ...REQUIRED, [k]: '   ' })).toBeNull();
    }
  });
  it('builds the default public base from bucket and region', () => {
    expect(storageConfig(REQUIRED)).toEqual({ bucket: 'b', region: 'ap-south-1', publicBase: 'https://b.s3.ap-south-1.amazonaws.com', keyPrefix: '' });
  });
  it('honours S3_PUBLIC_BASE_URL (trailing slash trimmed) and normalises S3_KEY_PREFIX', () => {
    expect(storageConfig({ ...REQUIRED, S3_PUBLIC_BASE_URL: 'https://img.example.com/' })!.publicBase).toBe('https://img.example.com');
    for (const p of ['dev', '/dev/', 'dev/']) expect(storageConfig({ ...REQUIRED, S3_KEY_PREFIX: p })!.keyPrefix).toBe('dev/');
    expect(storageConfig({ ...REQUIRED, S3_KEY_PREFIX: '' })!.keyPrefix).toBe('');
  });
});

describe('keys and urls', () => {
  it('newProductKey puts the file in the user folder with the right extension and a random name', () => {
    expect(newProductKey(cfg, 'U1', 'image/jpeg')).toMatch(/^products\/U1\/[0-9a-f-]{36}\.jpg$/);
    expect(newProductKey(cfg, 'U1', 'image/png')).toMatch(/\.png$/);
    expect(newProductKey(cfg, 'U1', 'image/webp')).toMatch(/\.webp$/);
    expect(newProductKey(devCfg, 'U1', 'image/png')).toMatch(/^dev\/products\/U1\//);
    expect(newProductKey(cfg, 'U1', 'image/png')).not.toBe(newProductKey(cfg, 'U1', 'image/png'));
  });
  it('publicUrlFor joins base and key with one slash', () => {
    expect(publicUrlFor(cfg, 'products/U1/a.jpg')).toBe('https://b.s3.ap-south-1.amazonaws.com/products/U1/a.jpg');
  });
  it('keyFromUrl returns the key only for a clean bucket url inside products/', () => {
    const base = cfg.publicBase;
    expect(keyFromUrl(cfg, `${base}/products/U1/a.jpg`)).toBe('products/U1/a.jpg');
    expect(keyFromUrl(devCfg, `${base}/dev/products/U1/a.jpg`)).toBe('dev/products/U1/a.jpg');
    for (const bad of [
      'https://cdn.example.com/products/U1/a.jpg', `http://b.s3.ap-south-1.amazonaws.com/products/U1/a.jpg`,
      'https://b.s3.ap-south-1.amazonaws.com.evil.com/products/U1/a.jpg', `${base}/other/a.jpg`, `${base}/products/../secret.jpg`,
      `${base}/products/U1/../U2/a.jpg`, `${base}/products/U1/a.jpg?x=1`, `${base}/products/U1/a.jpg#f`, '', `${base}/`, `${base}/products/`,
    ]) expect(keyFromUrl(cfg, bad), bad).toBeUndefined();
    expect(keyFromUrl(devCfg, `${base}/products/U1/a.jpg`)).toBeUndefined(); // outside the configured prefix
  });
});

describe('logos area', () => {
  it('keyFromUrl (the only way a product photo is accepted) rejects a logos/ url', () => {
    expect(keyFromUrl(cfg, publicUrlFor(cfg, 'logos/U1/abc.png'))).toBeUndefined();
  });
});

describe('presignProductUpload', () => {
  const fake = () => vi.fn(async (_c: unknown, opts: any) => ({ url: 'https://b.s3.ap-south-1.amazonaws.com/', fields: { ...opts.Fields, key: opts.Key } }));

  it('allows exactly one key, the declared type and 1 byte to 5 MB, for 5 minutes', async () => {
    const createPost = fake();
    const r = await presignProductUpload(cfg, 'U1', { contentType: 'image/png', size: 1234 }, createPost as never);
    const opts = createPost.mock.calls[0][1];
    expect(opts.Bucket).toBe('b');
    expect(opts.Key).toBe(r.key);
    expect(r.key).toMatch(/^products\/U1\/[0-9a-f-]{36}\.png$/);
    expect(opts.Expires).toBe(300);
    expect(opts.Conditions).toEqual(expect.arrayContaining([['content-length-range', 1, 5242880], ['eq', '$Content-Type', 'image/png']]));
    expect(opts.Fields['Content-Type']).toBe('image/png');
    expect(r.url).toBe('https://b.s3.ap-south-1.amazonaws.com/');
    expect(r.fields.key).toBe(r.key);
    expect(r.publicUrl).toBe(`https://b.s3.ap-south-1.amazonaws.com/${r.key}`);
  });
  it('rejects other content types and bad sizes with 400 and never signs', async () => {
    const createPost = fake();
    for (const contentType of ['image/svg+xml', 'text/html', 'image/gif', '', undefined, 5])
      await expect(presignProductUpload(cfg, 'U1', { contentType, size: 100 }, createPost as never)).rejects.toMatchObject({ status: 400 });
    for (const size of [0, -1, 5242881, 1.5, '100', NaN, undefined])
      await expect(presignProductUpload(cfg, 'U1', { contentType: 'image/png', size }, createPost as never)).rejects.toMatchObject({ status: 400 });
    expect(createPost).not.toHaveBeenCalled();
  });
  it('accepts the smallest and the largest allowed size', async () => {
    const createPost = fake();
    for (const size of [1, 5242880]) await expect(presignProductUpload(cfg, 'U1', { contentType: 'image/webp', size }, createPost as never)).resolves.toBeDefined();
  });
});

describe('deleteObjects', () => {
  it('sends one batch delete for all keys', async () => {
    const send = vi.fn(async (_cmd: unknown) => ({}));
    await deleteObjects(cfg, ['products/U1/a.jpg', 'products/U1/b.png'], send);
    expect(send).toHaveBeenCalledTimes(1);
    const cmd = send.mock.calls[0][0] as { input: { Bucket: string; Delete: { Objects: { Key: string }[] } } };
    expect(cmd.input.Bucket).toBe('b');
    expect(cmd.input.Delete.Objects).toEqual([{ Key: 'products/U1/a.jpg' }, { Key: 'products/U1/b.png' }]);
  });
  it('does nothing for an empty list and never throws when S3 fails', async () => {
    const send = vi.fn(async (_cmd: unknown): Promise<unknown> => { throw new Error('AccessDenied'); });
    await deleteObjects(cfg, [], send);
    expect(send).not.toHaveBeenCalled();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(deleteObjects(cfg, ['products/U1/a.jpg'], send)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
    log.mockRestore();
  });
});
