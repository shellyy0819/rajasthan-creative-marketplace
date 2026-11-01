import fs from 'node:fs';

/**
 * The stylesheet with comments removed and whitespace collapsed to the minified form
 * (`.a{b:c;d:e}`), so tests that match CSS text do not depend on how the file is formatted.
 */
export function readCss(file = 'src/app/globals.css'): string {
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{};,])\s*/g, '$1')
    .replace(/:\s+/g, ':') // a space BEFORE a colon is kept: `:has(> :required)` is written that way in the source
    .replace(/;}/g, '}')
    .replace(/\s+>\s+(?![^()]*\))/g, '>') // `a > b` -> `a>b` outside parentheses; `:has(> x > y)` keeps its spaces
    .replace(/@media\s+\(/g, '@media(')
    .replace(/\s+/g, ' ')
    .trim();
}
