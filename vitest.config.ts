import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@shared-types': resolve(__dirname, 'src/shared-types'),
    },
    conditions: ['development', 'browser'],
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    // 컴포넌트 테스트(.tsx)는 파일 상단 @vitest-environment jsdom 주석으로 전환
  },
})
