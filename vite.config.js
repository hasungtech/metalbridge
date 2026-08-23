import { defineConfig } from 'vite';

import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    // 공개 페이지와 백오피스는 별도 진입점 — 담당자 코드가 방문자에게 내려가지 않게
    rollupOptions: {
      input: {
        main:  resolve(__dirname, 'index.html'),
        admin:   resolve(__dirname, 'admin.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms:   resolve(__dirname, 'terms.html'),
        brand:   resolve(__dirname, 'brand.html'),
      },
      // 파서 라이브러리는 별도 청크로 — 첫 로딩을 가볍게, 백오피스는 아예 안 받게
      output: {
        manualChunks: {
          xlsx: ['xlsx'],
          pdf: ['pdfjs-dist/legacy/build/pdf'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
