/** Home-page options an admin can change. Plain values only (no database), so the browser bundle can use them too. */
export type HomeSettings = {
  /** How many seconds the "Our sellers" carousel stays on one maker before it moves to the next. */
  makersRotateSeconds: number;
};
export const MAKERS_ROTATE_MIN_SECONDS = 2;
export const MAKERS_ROTATE_MAX_SECONDS = 60;
export const DEFAULT_HOME_SETTINGS: HomeSettings = { makersRotateSeconds: 5 };
export const validRotateSeconds = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= MAKERS_ROTATE_MIN_SECONDS && v <= MAKERS_ROTATE_MAX_SECONDS;
