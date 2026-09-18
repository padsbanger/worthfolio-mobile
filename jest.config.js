module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  modulePathIgnorePatterns: ['<rootDir>/android/', '<rootDir>/ios/', '<rootDir>/artifacts/'],
  clearMocks: true,
};
