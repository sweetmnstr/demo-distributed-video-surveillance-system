const base = require('../../jest.config.base.js');
module.exports = {
  ...base,
  rootDir: '.',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/ports/**',
    '!src/main.ts',
  ],
};
