import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

export default defineConfig({
  // tsconfig 里 jsx=preserve 是 Next 的要求；vitest 4 用 oxc 转换，需显式打开 JSX，
  // 否则 .tsx 测试文件会在 import 分析阶段报 "invalid JS syntax"。
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
