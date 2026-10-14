import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Db } from './types';

const dbPath = () => process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'db.json');

export async function readDb(): Promise<Db> {
  return JSON.parse(await fs.readFile(dbPath(), 'utf8')) as Db;
}

let queue: Promise<unknown> = Promise.resolve();

export function mutateDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    const tmp = `${dbPath()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.rename(tmp, dbPath());
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}
