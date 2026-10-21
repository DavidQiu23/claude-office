import { defineConfig } from 'vite';
// 前端建置設定；web/ 於後續 task 建立
export default defineConfig({ root: 'web', build: { outDir: '../dist/web', emptyOutDir: true } });
