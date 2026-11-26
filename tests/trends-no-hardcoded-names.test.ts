// Guard: the market trends feature must not hardcode a place or site-brand name.
// The site name comes from SITE.name, wording from the catalog wording helper, and the
// region from settings or the cities in use. This reads the feature's source files from
// disk and fails if one of them names a place or brand outside a comment.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BANNED = /rajasthan|craftofy|jaipur|udaipur|jodhpur/gi;

// One left-to-right pass drops block comments (also CSS, and JSX `{/* ... */}` which leaves
// an empty `{}`) and `//` line comments. A `//` only starts a comment when it is not preceded
// by `:`, so the `//` of a URL string such as https://x.example survives. Dropped comments
// keep their newlines so reported line numbers stay true.
const COMMENT = /\/\*[\s\S]*?\*\/|(?<!:)\/\/.*$/gm;

function findHardcodedNames(source: string): string[] {
  const code = source.replace(COMMENT, (c) => c.replace(/[^\n]/g, ''));
  const found: string[] = [];
  code.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(BANNED)) found.push(`line ${i + 1}: ${m[0]}`);
  });
  return found;
}

function listFiles(dir: string, { recursive = true, match = /\.(tsx?|css)$/ } = {}): string[] {
  const abs = path.join(ROOT, dir);
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    const rel = path.posix.join(dir, name);
    if (statSync(path.join(ROOT, rel)).isDirectory()) {
      if (recursive) out.push(...listFiles(rel, { recursive, match }));
    } else if (match.test(name)) out.push(rel);
  }
  return out;
}

// Discovered at test time, so a new file in any of these places is covered automatically.
function scannedFiles(): string[] {
  return [
    ...listFiles('src/lib', { recursive: false, match: /^trend-.*\.ts$/ }),
    ...listFiles('src/components/trends'),
    'src/components/MarketTrendsAdmin.tsx',
    'src/components/MarketTrendsAdmin.css',
    'src/components/TrendSettingsForm.tsx',
    ...listFiles('src/app/dashboard/market-trends'),
    ...listFiles('src/app/api/admin/trends'),
    ...listFiles('src/app/api/admin/settings/trends'),
  ].sort();
}

describe('scanner', () => {
  it('reports a hardcoded name in code', () => {
    expect(findHardcodedNames('const heading = Jaipur;')).toEqual(['line 1: Jaipur']);
  });
  it('reports a name in a string literal', () => {
    expect(findHardcodedNames(`const t = 'Made in Rajasthan';`)).toHaveLength(1);
    expect(findHardcodedNames('const t = `Welcome to Craftofy`;')).toHaveLength(1);
  });
  it('ignores a name in a // comment, trailing or on its own line', () => {
    expect(findHardcodedNames('// Jaipur is a city\nconst a = 1; // Udaipur too')).toEqual([]);
  });
  it('ignores a name in a block comment, including multi-line and CSS ones', () => {
    expect(findHardcodedNames('/* Jodhpur */ const a = 1;')).toEqual([]);
    expect(findHardcodedNames('/**\n * Craftofy\n */\n.a { color: red; }')).toEqual([]);
  });
  it('ignores a name in a JSX comment', () => {
    expect(findHardcodedNames('<div>{/* Rajasthan */}<b /></div>')).toEqual([]);
  });
  it('does not let the // of a URL break comment stripping', () => {
    expect(findHardcodedNames(`const u = 'https://x.example'; const c = 'Jaipur';`)).toEqual(['line 1: Jaipur']);
    expect(findHardcodedNames(`const u = 'https://x.example'; // Jaipur`)).toEqual([]);
    expect(findHardcodedNames(`const u = 'https://x.example/Jaipur';`)).toHaveLength(1);
  });
  it('matches case-insensitively', () => {
    expect(findHardcodedNames('const a = "RAJASTHAN"; const b = "jodhpur";')).toHaveLength(2);
  });
  it('reports the line of each hit', () => {
    expect(findHardcodedNames('/* a\nb */\nconst a = "Udaipur";')).toEqual(['line 3: Udaipur']);
  });
});

describe('files', () => {
  const files = scannedFiles();
  it.each([
    'src/lib/trend-store.ts',
    'src/lib/trend-types.ts',
    'src/components/trends/TrendsBlock.tsx',
    'src/components/trends/TrendsBlock.css',
    'src/components/MarketTrendsAdmin.tsx',
    'src/components/TrendSettingsForm.tsx',
    'src/app/dashboard/market-trends/page.tsx',
    'src/app/api/admin/trends/route.ts',
    'src/app/api/admin/settings/trends/route.ts',
  ])('discovers %s', (core) => {
    expect(files).toContain(core);
  });
  it('discovers a route nested under src/app/api/admin/trends/', () => {
    expect(files.filter((f) => f.startsWith('src/app/api/admin/trends/') && f.endsWith('/route.ts')).length).toBeGreaterThan(1);
  });
  it('scans more than 15 files in total', () => {
    expect(files.length).toBeGreaterThan(15);
  });
});

describe('market trends source', () => {
  it.each(scannedFiles())('%s has no hardcoded place or brand name', (file) => {
    expect(findHardcodedNames(readFileSync(path.join(ROOT, file), 'utf8'))).toEqual([]);
  });
});
