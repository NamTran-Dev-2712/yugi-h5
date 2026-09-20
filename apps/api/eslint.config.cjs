// @ts-check
const baseConfig = require('../../packages/config/eslint.base.js');

module.exports = [
  ...baseConfig,
  {
    rules: {
      // Nest relies on parameter decorators / DI which read as "unused" to this rule.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
