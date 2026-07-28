export default {
  testEnvironment: 'node',
  transform: {},
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  testTimeout: 30000, // 30s reicht – 180s war viel zu lang
  forceExit: true,    // Beendet Jest auch bei offenen Handles
  detectOpenHandles: true, // Zeigt an, welche Handles noch offen sind
};