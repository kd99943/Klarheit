import { build } from 'vite';
import { copyFile, mkdir } from 'node:fs/promises';

// Exercise bundled workers and chunks without changing the application build entry.
const outDir = 'node_modules/.cache/ar-browser-build';
await build({
  build: {
    outDir,
    rollupOptions: { input: 'tests/browser/ar-realism.html' },
  },
});
await mkdir(`${outDir}/tests/browser`, { recursive: true });
await copyFile('tests/browser/portrait.jpg', `${outDir}/tests/browser/portrait.jpg`);
