/**
 * The rural sports game: a tug of war against the village team. Plain functions, so it is easy to test.
 * The rope marker sits between -1 (the other team has pulled you over the line) and 1 (you have pulled them over). It starts in the middle.
 */
export const TUG_SECONDS = 10;
/** How far one tap pulls the rope. */
export const TAP_PULL = .08;
/** How hard the other team pulls, per second, on average: about four taps a second holds the rope even. */
export const OPPONENT_PULL = .3;
export type TugResult = 'won' | 'lost' | null;

/** The other team heaves in waves, so the rope surges and slackens instead of crawling. */
export const opponentPull = (elapsed: number) => OPPONENT_PULL * (.75 + .5 * (1 + Math.sin(elapsed * 3)) / 2);
export const tugTap = (pos: number) => Math.min(1, pos + TAP_PULL);
export const tugTick = (pos: number, dt: number, elapsed: number) => Math.max(-1, pos - opponentPull(elapsed) * dt);
/** Over the line either way ends it at once; when time is up, whoever has the rope on their side wins. */
export function tugResult(pos: number, elapsed: number): TugResult {
  if (pos >= 1) return 'won';
  if (pos <= -1) return 'lost';
  if (elapsed >= TUG_SECONDS) return pos > 0 ? 'won' : 'lost';
  return null;
}
