// Client-safe (no db imports): display labels for a list of cities.
type Labelled = { name: string; state?: string };

/** The city's name, with ", State" appended when another city in the list shares that name (case-insensitive). */
export function cityLabeller(list: readonly Labelled[]): (c: Labelled) => string {
  const counts = new Map<string, number>();
  for (const c of list) { const k = c.name.trim().toLowerCase(); counts.set(k, (counts.get(k) ?? 0) + 1); }
  return c => (c.state && (counts.get(c.name.trim().toLowerCase()) ?? 0) > 1 ? `${c.name}, ${c.state}` : c.name);
}
