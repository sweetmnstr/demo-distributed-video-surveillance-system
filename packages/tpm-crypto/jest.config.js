const base = require('../../jest.config.base.js');
module.exports = {
  ...base,
  rootDir: '.',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/tpm-device.ts',
    '!src/windows-tpm-device.ts',
    '!src/index.ts',
  ],
};
