const base = require('../../jest.config.base.js');
module.exports = {
  ...base,
  rootDir: '.',
  // browser.ts, like index.ts, is a pure re-export barrel (the browser-safe entry
  // point) with no logic of its own, so it is excluded from coverage.
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/index.ts', '!src/browser.ts'],
};
