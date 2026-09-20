// @ts-check
const baseConfig = require('../config/eslint.base.js');

module.exports = [
  ...baseConfig,
  {
    // Enforce engine purity: no Math.random / Date.now / Node or browser globals.
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Engine must be deterministic — pass time via ctx if ever needed.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Engine must be deterministic — use the seeded RNG from rng/ instead of Math.random().',
        },
      ],
    },
  },
];
