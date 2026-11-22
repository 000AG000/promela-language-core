import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Keep generated parser output, vendor files, and the VS Code example out of
// this project's lint run. The example has a separate package and tsconfig.
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'release/**',
      'assets/**',
      'grammar/**',
      'integration/**',
      'vendor/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    rules: {
      // TypeScript checks unresolved names, more accurately than no-undef.
      'no-undef': 'off',
      // Existing code intentionally uses assertions after AST checks.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
