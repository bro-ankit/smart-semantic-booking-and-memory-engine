import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'test/tsconfig.json' }],
    '^.+\\.js$': ['ts-jest', { tsconfig: 'test/tsconfig.json', diagnostics: false }],
  },
  // jsdom ships several transitive deps as pure ESM — transform them through ts-jest
  transformIgnorePatterns: [
    '/node_modules/(?!(@exodus/bytes|html-encoding-sniffer|whatwg-encoding|w3c-xmlserializer)/)',
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/test/setup-tests.ts'],
  testEnvironment: 'node',
  injectGlobals: true,
  forceExit: true,
  maxWorkers: 1,
};

export default config;
