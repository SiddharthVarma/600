import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Two pages: the constellation (index.html) and the repair lab it opens in iframes (react.html).
// Images live in public/ and are referenced by plain paths at runtime, so they are copied as-is.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', repair: 'react.html' },
    },
  },
});
