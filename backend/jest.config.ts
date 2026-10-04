import type { Config } from 'jest';
import { createDefaultPreset } from 'ts-jest';

const config: Config = {
  verbose: false,
  testMatch: ['**/tests/**/*.test.(ts|js)'],
  globalSetup: '<rootDir>/tests/global/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/global/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/global/setupTests.ts'],
  ...createDefaultPreset(),
};

export default config;
