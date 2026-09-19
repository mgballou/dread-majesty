import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  test: { name: 'calibration', include: ['src/**/*.test.ts'] },
});
