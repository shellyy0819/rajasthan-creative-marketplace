import { defineConfig } from '@playwright/test';

// Real-browser layout test (npm run test:layout). Needs `npx playwright install chromium` once.
// No web server and no database: the spec renders static HTML itself.
export default defineConfig({
  testDir: './tests-layout',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  reporter: 'list',
  outputDir: 'node_modules/.cache/playwright-layout',
  use: { browserName: 'chromium' },
});
