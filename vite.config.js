import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Two pages: the constellation (index.html) and the repair lab it opens in iframes (react.html).
// Images live in public/ and are referenced by plain paths at runtime, so they are copied as-is.
// The game is served at varmasiddharth.com/sixhundred/, so it builds into dist/sixhundred/ with every URL under
// that prefix; paths in the code stay relative to the page, so they need no prefix of their own.
export default defineConfig({
  plugins: [react()],
  base: '/sixhundred/',
  build: {
    outDir: 'dist/sixhundred',
    rollupOptions: {
      input: { main: 'index.html', repair: 'react.html' },
    },
  },
});
