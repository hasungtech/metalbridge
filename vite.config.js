import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    // 파서 라이브러리는 별도 청크로 분리 — 첫 로딩을 가볍게
    rollupOptions: {
      output: {
        manualChunks: {
          xlsx: ['xlsx'],
          pdf: ['pdfjs-dist/legacy/build/pdf'],
          three: ['three'],
        },
      },
    },
  },
});
