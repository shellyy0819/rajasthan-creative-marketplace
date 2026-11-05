const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const PROMISES = [
  {
    title: 'No Commission, Just Honest Prices',
    text: 'Shop unique handmade creations without additional marketplace commission fees.',
    icon: <><path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /><path d="m9 15 6-6M9.5 9.5h.01M14.5 14.5h.01" /></>,
  },
  {
    title: 'Straight from the Artist',
    text: 'Every creation comes directly from the hands of the artist who made it.',
    icon: <><path d="M3 7l9-4 9 4v10l-9 4-9-4V7Z" /><path d="m3 7 9 4 9-4M12 11v10" /></>,
  },
  {
    title: 'Your Purchase Makes a Difference',
    text: 'Discover independent makers, celebrate their creativity, and support small businesses.',
    icon: <><circle cx="6" cy="7" r="2.5" /><circle cx="18" cy="7" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8 8.5l3 7M16 8.5l-3 7" /></>,
  },
];

/** Three promises to buyers and makers, shown on the home page right after the hero. */
export function ValueProps() {
  return (
    <section className="value-props" aria-label="Why Craftofy">
      <ul>
        {PROMISES.map(p => (
          <li key={p.title}>
            <svg viewBox="0 0 24 24" aria-hidden="true" {...ICON}>{p.icon}</svg>
            <div><h3>{p.title}</h3><p>{p.text}</p></div>
          </li>
        ))}
      </ul>
    </section>
  );
}
