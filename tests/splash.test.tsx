import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { themeInitScript } from '@/lib/init-scripts';

describe('no splash screen (there is no installed app that needs one)', () => {
  const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
  const css = fs.readFileSync('src/app/globals.css', 'utf8');
  it('the layout shows no splash overlay, loads no splash script and offers no iOS start-up images', () => {
    expect(layout).not.toMatch(/SplashScreen|splashInitScript|startupImage|\/splash\//);
  });
  it('the splash styles and component are gone', () => {
    expect(css).not.toMatch(/\.splash|splash-out|data-splash/);
    expect(fs.existsSync('src/components/SplashScreen.tsx')).toBe(false);
    expect(fs.existsSync('public/splash')).toBe(false);
  });
  it('the theme init script is still a plain string in the head (a client-module export would reach the server layout as a function stub)', () => {
    expect(typeof themeInitScript).toBe('string');
    expect(layout).toContain("from '@/lib/init-scripts'");
    expect(layout).toContain('themeInitScript');
  });
});
