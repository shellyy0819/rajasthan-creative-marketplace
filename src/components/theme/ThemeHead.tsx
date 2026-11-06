import type { PresetKey } from '@/lib/themes/presets';

/** `<` becomes a CSS escape, so nothing in the css can close the style element or open a tag. */
const safe = (css: string) => css.replace(/</g, '\\3c ');

export function ThemeHead({ preset, css }: { preset: PresetKey; css: string }) {
  return <style id="festive-theme" data-preset={preset} dangerouslySetInnerHTML={{ __html: safe(css) }} />;
}
