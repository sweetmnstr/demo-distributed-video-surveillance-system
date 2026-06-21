const base = require('../../jest.config.base.js');
module.exports = {
  ...base,
  rootDir: '.',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/process-runner.ts',
    '!src/real-runner.ts',
    '!src/main.ts',
  ],
};
