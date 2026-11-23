import { execFileSync } from 'node:child_process';

/** Which build is running. Admin only: it is shown in the dashboard and returned by /api/admin/version, and appears on no public page. */
export type AppVersion = {
  /** Full commit hash the image was built from, or null when the build did not say. */
  commit: string | null;
  shortCommit: string | null;
  /** When the image was built (ISO, UTC), or null. */
  builtAt: string | null;
  environment: string;
};

const HASH = /^[0-9a-f]{7,40}$/i;

function devCommit(): string | null {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}

/**
 * Read from APP_COMMIT and APP_BUILT_AT, which the Docker build bakes into the image (`npm run docker:up` sets them from git).
 * A value that is not a commit hash or a date is ignored, never shown. Only `next dev` falls back to asking git.
 */
export function appVersion(env: Record<string, string | undefined> = process.env): AppVersion {
  const raw = (env.APP_COMMIT ?? '').trim();
  const fromEnv = HASH.test(raw) ? raw.toLowerCase() : null;
  const commit = fromEnv ?? (env.NODE_ENV === 'development' ? devCommit() : null);
  const built = (env.APP_BUILT_AT ?? '').trim();
  const builtAt = built && !Number.isNaN(Date.parse(built)) ? new Date(built).toISOString() : null;
  return { commit, shortCommit: commit ? commit.slice(0, 7) : null, builtAt, environment: env.NODE_ENV ?? 'unknown' };
}

/** "23 Nov 2026, 11:30 UTC" */
export const formatBuiltAt = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).replace(/,?\s(\d{2}:\d{2})$/, ', $1') + ' UTC';
