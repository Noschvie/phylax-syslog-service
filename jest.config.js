export default {
  testEnvironment: 'node',
  transform: {},
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true,
  globalSetup: './test/jest.globalSetup.js',
};