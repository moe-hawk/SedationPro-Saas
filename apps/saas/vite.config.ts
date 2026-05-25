import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // The SaaS app intentionally imports the original physician UI from
      // apps/mobile. The original app uses "@/..." internally, so this alias
      // makes those imports resolve without copying or forking the clinical UI.
      '@': fileURLToPath(new URL('../mobile/src', import.meta.url)),
      '@saas': fileURLToPath(new URL('./src', import.meta.url)),
      '@sedation-pro/clinical': fileURLToPath(new URL('../../packages/clinical/src/index.ts', import.meta.url)),
      '@sedation-pro/ui': fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5174,
  },
});
