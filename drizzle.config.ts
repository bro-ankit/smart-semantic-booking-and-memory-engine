import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env['POSTGRES_HOST'] ?? 'localhost',
    port: parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10),
    user: process.env['POSTGRES_USER'] ?? '',
    password: process.env['POSTGRES_PASSWORD'] ?? '',
    database: process.env['POSTGRES_DB'] ?? '',
    ssl: false,
  },
  verbose: true,
  strict: true,
});
