import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * `vitest/config` rather than `vite/config` so the test block below is typed. It is
 * the same `defineConfig`; the build path is unaffected.
 *
 * The root config names this file as a project, which is why the web tests get
 * jsdom and the engine tests keep their DOM-free world.
 */
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    name: 'web',
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
