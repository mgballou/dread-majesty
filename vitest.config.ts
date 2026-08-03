import { defineConfig } from 'vitest/config';

/**
 * Two projects, because the engine and the interface want different worlds.
 *
 * The engine is pure TypeScript and must keep running under plain Node with no DOM
 * — that constraint is load-bearing, so its tests get no DOM to lean on by
 * accident. The web app brings its own config, which is where jsdom and Testing
 * Library are set up.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'engine',
          include: ['packages/*/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      './apps/web',
    ],
  },
});
