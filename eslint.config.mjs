import globals from 'globals';

export default [
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'no-throw-literal': 'error',
    },
  },
  {
    ignores: ['node_modules/', 'coverage/'],
  },
  {
    files: ['tests/**/*.test.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
  },
];
