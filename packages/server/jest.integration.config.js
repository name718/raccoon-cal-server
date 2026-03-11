module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.{js,ts}', '!src/app.ts', '!src/config/**'],
  coverageDirectory: 'coverage/integration',
  testTimeout: 30000,
};
