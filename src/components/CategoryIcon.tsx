import '../app/categories/categories.css';

type Kind = 'pot' | 'crochet' | 'cloth' | 'resin' | 'bangle' | 'pouch' | 'decor' | 'cake' | 'wood' | 'painting' | 'flower';

/** Which little picture a category gets, from its name (categories are typed by sellers and admins). First match wins; anything else gets the flower. */
export function categoryIconKind(name: string): Kind {
  const n = name.toLowerCase();
  const rules: [RegExp, Kind][] = [
    [/pottery|ceramic|terracotta|clay/, 'pot'], [/crochet|knit|yarn|amigurumi/, 'crochet'], [/resin/, 'resin'],
    [/jewel|bangle|earring|necklace/, 'bangle'], [/bakery|cake|cookie|confection|sweet|food|snack/, 'cake'],
    [/wood|carv/, 'wood'], [/paint|canvas|miniature|pichwai|madhubani/, 'painting'], [/decor|home|vase|frame/, 'decor'],
    [/textile|saree|sari|handloom|cloth|fabric|bandhani|block.?print/, 'cloth'], [/accessor|bag|pouch|leather|purse/, 'pouch'],
  ];
  return rules.find(([re]) => re.test(n))?.[1] ?? 'flower';
}

const ART: Record<Kind, React.ReactNode> = {
  pot: <>
    <path className="c-clay" d="M11 16c0-2 2-3 9-3s9 1 9 3c1 5 0 12-4 15-1.5 1-3 1.5-5 1.5s-3.5-.5-5-1.5c-4-3-5-10-4-15Z" />
    <ellipse className="c-orange" cx="20" cy="13.5" rx="9" ry="2.8" />
    <path className="c-line" d="M13 21c4 2 10 2 14 0M14 26c3.5 1.5 8.5 1.5 12 0" />
  </>,
  crochet: <>
    {[0, 60, 120, 180, 240, 300].map(a => <circle key={a} className="c-clay" cx={20 + 8 * Math.cos((a * Math.PI) / 180)} cy={20 + 8 * Math.sin((a * Math.PI) / 180)} r="5.5" />)}
    <circle className="c-sand" cx="20" cy="20" r="4.5" /><circle className="c-orange" cx="20" cy="20" r="1.8" />
  </>,
  cloth: <>
    <rect className="c-sage" x="7" y="25" width="26" height="8" rx="2.5" />
    <rect className="c-sand" x="9" y="17" width="23" height="8" rx="2.5" />
    <rect className="c-clay" x="7" y="9" width="25" height="8" rx="2.5" />
    <path className="c-line" d="M12 13h16M14 21h14M12 29h16" />
  </>,
  resin: <>
    <circle className="c-sage-d" cx="20" cy="20" r="13" />
    <path className="c-sand-fill" d="M20 9c5 4 8 7 8 11a8 8 0 0 1-16 0c0-4 3-7 8-11Z" />
    <circle className="c-orange" cx="17" cy="21" r="1.8" /><circle className="c-clay" cx="23" cy="23.5" r="1.3" />
  </>,
  bangle: <>
    <circle className="c-ring-orange" cx="20" cy="20" r="11" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map(a => <circle key={a} className="c-sand" cx={20 + 11 * Math.cos((a * Math.PI) / 180)} cy={20 + 11 * Math.sin((a * Math.PI) / 180)} r="1.7" />)}
    <circle className="c-ring-sage" cx="20" cy="20" r="6" />
  </>,
  pouch: <>
    <path className="c-green" d="M12 16h16l3 16a2 2 0 0 1-2 2.2H11a2 2 0 0 1-2-2.2L12 16Z" />
    <path className="c-line" d="M13 16c1-5 3-7 7-7s6 2 7 7" /><path className="c-line-sand" d="M13 22c3 2 11 2 14 0" />
    <circle className="c-orange" cx="20" cy="27" r="2.3" />
  </>,
  decor: <>
    <path className="c-sage" d="M15 14h10l1 4c3 3 4 8 2 12-1 2-3 3-8 3s-7-1-8-3c-2-4-1-9 2-12l1-4Z" />
    <rect className="c-clay" x="16" y="9" width="8" height="5.5" rx="1.5" />
    <path className="c-line" d="M20 18v12M20 22c-3-1-4-3-4-5M20 25c3-1 4-3 4-5" />
  </>,
  cake: <>
    <path className="c-clay" d="M10 22h20l-2.5 11a2 2 0 0 1-2 1.5h-11a2 2 0 0 1-2-1.5L10 22Z" />
    <path className="c-line" d="M15 24v8M20 24v8M25 24v8" />
    <path className="c-sand" d="M9 22c0-5 4-7 6-7 0-3 3-5 5-5s5 2 5 5c2 0 6 2 6 7H9Z" />
    <circle className="c-orange" cx="20" cy="9.5" r="2.2" />
  </>,
  wood: <>
    <ellipse className="c-clay" cx="20" cy="20" rx="13" ry="13" />
    <circle className="c-ring-orange-thin" cx="20" cy="20" r="9" /><circle className="c-ring-orange-thin" cx="20" cy="20" r="5" /><circle className="c-orange" cx="20" cy="20" r="1.7" />
  </>,
  painting: <>
    <rect className="c-clay" x="5" y="8" width="30" height="24" rx="2.5" />
    <rect className="c-sage" x="8.5" y="11.5" width="23" height="17" rx="1" />
    <circle className="c-orange" cx="25" cy="17" r="3" />
    <path className="c-green" d="M8.5 28.5l7-9 5 5.5 4-4 7 7.5H8.5Z" />
  </>,
  flower: <>
    {[0, 72, 144, 216, 288].map(a => <circle key={a} className="c-clay" cx={20 + 8 * Math.cos(((a - 90) * Math.PI) / 180)} cy={20 + 8 * Math.sin(((a - 90) * Math.PI) / 180)} r="6" />)}
    <circle className="c-sand" cx="20" cy="20" r="4.5" /><circle className="c-orange" cx="20" cy="20" r="1.8" />
  </>,
};

/** A small flat illustration in front of a category name, in the stall's colours. Decorative (the name is always next to it). Used on the category cards, not in the page heading. */
export function CategoryIcon({ name }: { name: string }) {
  const kind = categoryIconKind(name);
  return (
    <svg className="cat-ic" data-kind={kind} viewBox="0 0 40 40" aria-hidden="true" focusable="false">{ART[kind]}</svg>
  );
}
