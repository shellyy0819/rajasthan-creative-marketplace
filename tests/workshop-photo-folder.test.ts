import { describe, expect, it } from 'vitest';
import { REQUEST_AREA, isRequestImageUrl, storageConfig } from '@/lib/storage';

const cfg = storageConfig({ S3_BUCKET: 'b', S3_REGION: 'ap-south-1', AWS_ACCESS_KEY_ID: 'k', AWS_SECRET_ACCESS_KEY: 's' })!;
const base = 'https://b.s3.ap-south-1.amazonaws.com';

describe('workshop photos', () => {
  it('live in the workshop-requests/ folder, the one the bucket policy allows', () => { expect(REQUEST_AREA.folder).toBe('workshop-requests'); });
  it('a photo in workshop-requests/ is accepted', () => {
    expect(isRequestImageUrl(cfg, `${base}/workshop-requests/public/a.jpg`)).toBe(true);
  });
  it('products, logos and other places are refused, and so is a path trick', () => {
    for (const u of [`${base}/products/public/a.jpg`, `${base}/logos/public/a.jpg`, `${base}/workshops/public/a.jpg`, `${base}/workshop-requests/a.jpg`, `${base}/workshop-requests/public/../a.jpg`, `${base}/workshop-requestsx/public/a.jpg`]) expect(isRequestImageUrl(cfg, u), u).toBe(false);
  });
});
