const base = require('../../jest.config.base.js');
module.exports = {
  ...base,
  rootDir: '.',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/tpm-device.ts',
    '!src/tpm-native.ts',   // thin bindings() loader; verified via Windows round-trip
    '!src/index.ts',
  ],
};
