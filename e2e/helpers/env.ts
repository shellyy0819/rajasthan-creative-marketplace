import fs from 'node:fs';
import path from 'node:path';

/** Load .env.local into process.env (Node 18 has no loadEnvFile). Existing vars win. localhost -> 127.0.0.1 avoids IPv6 refusals. */
export function loadEnv(): void {
  const file = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || line.trimStart().startsWith('#')) continue;
      if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace('@localhost', '@127.0.0.1');
}
