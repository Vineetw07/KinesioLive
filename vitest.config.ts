import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@cometchat/calls-sdk-javascript': path.resolve(__dirname, 'tests/mocks/calls-sdk.ts'),
      '@cometchat/chat-sdk-javascript': path.resolve(__dirname, 'tests/mocks/chat-sdk.ts'),
    },
  },
});
