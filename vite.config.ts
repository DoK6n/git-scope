import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@shared-types': resolve(__dirname, 'src/shared-types'),
    },
  },
  build: {
    outDir: 'dist/webview',
    emptyOutDir: true,
    // webview는 상대 경로 에셋을 로드할 수 없으므로 이미지류는 data URI로 인라인한다
    assetsInlineLimit: 100000,
    // 익스텐션 host가 고정 파일명으로 참조하므로 해시를 붙이지 않는다
    rollupOptions: {
      input: resolve(__dirname, 'src/webview/app/index.tsx'),
      output: {
        entryFileNames: 'main.js',
        assetFileNames: 'main[extname]',
      },
    },
  },
})
