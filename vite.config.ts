import { defineConfig } from 'vite';
// 前端建置設定：web/ 輸出到 dist/web
export default defineConfig({ root: 'web', build: { outDir: '../dist/web', emptyOutDir: true } });
