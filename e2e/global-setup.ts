import { loadEnv } from './helpers/env';
import { cleanE2E, seedE2E } from './helpers/fixtures';

export default async function globalSetup() {
  loadEnv();
  await cleanE2E();
  await seedE2E();
}
