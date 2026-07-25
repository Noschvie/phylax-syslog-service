export default {
  testEnvironment: 'node',
  transform: {},
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  testTimeout: 180000,
};
