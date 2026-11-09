import { loadEnv } from './helpers/env';
import { cleanE2E } from './helpers/fixtures';

export default async function globalTeardown() {
  loadEnv();
  await cleanE2E();
}
