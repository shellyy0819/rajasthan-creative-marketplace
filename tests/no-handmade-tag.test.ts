import { describe, it, expect } from 'vitest';
import { readCss } from './helpers/css';

describe('product photo has no "HANDMADE" corner tag', () => {
  it('no stylesheet rule generates the HANDMADE label on a product visual', () => {
    expect(readCss()).not.toMatch(/content:\s*"HANDMADE"/i);
  });
});
