// Run with tsx (see layout-shift.spec.ts). Prints { preset: html } for every preset as JSON.
// Playwright's own JSX transform is for component tests and breaks real React rendering,
// so the React side runs in a separate plain-tsx process.
import fs from 'node:fs';
import path from 'node:path';
import { presetKeys, renderTop } from './render-top';

const css = fs.readFileSync(path.resolve(import.meta.dirname, '../src/app/globals.css'), 'utf8');
process.stdout.write(JSON.stringify(Object.fromEntries(presetKeys().map((k) => [k, renderTop(k, css)]))));
