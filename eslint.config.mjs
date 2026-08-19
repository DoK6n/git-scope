import js from '@eslint/js'
import solid from 'eslint-plugin-solid/configs/typescript'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', '*.vsix', 'esbuild.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // webview(SolidJS)에는 반응성 실수 검사 추가
  {
    files: ['src/webview/**/*.{ts,tsx}'],
    ...solid,
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // strict 모드 + noUncheckedIndexedAccess 하에서 non-null 단언은 의도적으로 쓴다
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
)
