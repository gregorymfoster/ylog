import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['cjs'],
  sourcemap: true,
  clean: true,
  dts: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  outDir: 'dist',
  target: 'node20',
});