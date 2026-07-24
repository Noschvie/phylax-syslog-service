import importPlugin from 'eslint-plugin-import';

export default [
  {
    ignores: ['node_modules/', 'coverage/', 'dist/', 'logs/'],
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'warn',
      'import/extensions': 'off',
      'no-underscore-dangle': 'off',
      'class-methods-use-this': 'off',
    },
  },
];
