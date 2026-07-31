import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/wakaru/dictionary/schema.ts',
  dbCredentials: {
    url:
      process.env.WAKARU_DICTIONARY_PATH ??
      './assets/runtime/dictionary.sqlite',
  },
  strict: true,
  verbose: true,
});
