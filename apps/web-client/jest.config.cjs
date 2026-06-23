module.exports = {
  rootDir: '.',
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'CommonJS', esModuleInterop: true, jsx: 'react-jsx' } }],
  },
  collectCoverageFrom: ['src/lib/**/*.ts', '!src/**/*.test.ts'],
  coverageThreshold: {
    'src/lib/**': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
