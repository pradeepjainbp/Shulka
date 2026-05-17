import { defineConfig } from 'drizzle-kit'

if (!process.env['DATABASE_URL_UNPOOLED']) {
  throw new Error('DATABASE_URL_UNPOOLED is required for migrations')
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL_UNPOOLED'],
  },
  verbose: true,
  strict: true,
})
