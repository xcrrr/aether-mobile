/**
 * Unit tests cover pure logic only (storage, registry, prompt, paths, format).
 * We scope roots to `src/` so Jest never crawls node_modules for its haste map —
 * this avoids a config-discovery clash with packages that ship their own jest
 * config + native folders (e.g. react-native-marked).
 */
module.exports = {
  preset: 'jest-expo',
  rootDir: __dirname,
  roots: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
