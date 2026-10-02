import { defineConfig } from 'vitest/config';

/**
 * Two projects, because the engine and the interface want different worlds.
 *
 * The engine is pure TypeScript and must keep running under plain Node with no DOM
 * — that constraint is load-bearing, so its tests get no DOM to lean on by
 * accident. The web app brings its own config, which is where jsdom and Testing
 * Library are set up. The calibration app brings its own too; its tests need no DOM.
 */
export default defineConfig({
  test: {
    /**
     * Node 25 and later ship their own `localStorage`, and under jsdom it shadows
     * jsdom's. With no `--localstorage-file` it is an empty shell, so every web test
     * that writes or reads a save fails. Turning it off hands the global back to
     * jsdom. Node 22, which the repo pins, accepts the flag and changes nothing.
     *
     * It lives here because Vitest reads worker arguments only from the root config;
     * a project cannot set its own.
     */
    pool: 'forks',
    poolOptions: {
      forks: { execArgv: ['--no-experimental-webstorage'] },
    },
    projects: [
      {
        test: {
          name: 'engine',
          include: ['packages/*/test/**/*.test.ts', 'packages/*/conformance/**/*.test.ts'],
          environment: 'node',
        },
      },
      './apps/web',
      './apps/calibration',
    ],
  },
});
