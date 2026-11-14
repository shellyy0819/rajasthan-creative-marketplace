import path from 'node:path';
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// One static HTML document per theme (Everyday + every key of PRESETS), rendered by plain tsx.
const root = path.resolve(__dirname, '..');
const pages: Record<string, string> = JSON.parse(
  execFileSync(path.join(root, 'node_modules/.bin/tsx'), ['--tsconfig', path.join(root, 'tsconfig.json'), path.join(__dirname, 'render-all.tsx')], { cwd: root, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }),
);

const VIEWPORTS = [
  { name: 'desktop 1280x800', width: 1280, height: 800 },
  { name: 'mobile 390x844', width: 390, height: 844 },
];
// Blocks that must not move or resize when the theme changes.
const BLOCKS = { banner: '.festive-banner', header: 'header.topbar', 'hero copy': '.hero-copy', 'hero art': '.hero-art' };

type Box = { x: number; y: number; width: number; height: number };

test.describe('festive themes never shift the layout', () => {
  for (const vp of VIEWPORTS) {
    test(vp.name, async ({ browser }) => {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const boxes: Record<string, Record<string, Box>> = {};
      for (const [preset, html] of Object.entries(pages)) {
        await page.setContent(html, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        boxes[preset] = {};
        for (const [name, sel] of Object.entries(BLOCKS)) {
          const loc = page.locator(sel);
          expect(await loc.count(), `${preset}: ${name} (${sel}) must exist exactly once`).toBe(1);
          const b = (await loc.boundingBox())!;
          boxes[preset][name] = { x: b.x, y: b.y, width: b.width, height: b.height };
        }
      }
      await page.close();

      const base = boxes.everyday;
      for (const [preset, byBlock] of Object.entries(boxes)) {
        for (const name of Object.keys(BLOCKS)) {
          expect(byBlock[name], `${name} under "${preset}" differs from Everyday at ${vp.name}`).toEqual(base[name]);
        }
      }
    });
  }
});
