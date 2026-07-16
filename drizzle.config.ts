import 'dotenv/config';

import { defineConfig } from 'drizzle-kit';

const host = process.env['DB_HOST'] ?? 'localhost';
const port = process.env['DB_PORT'] ?? '5432';
const user = process.env['DB_USER'] ?? '';
const password = process.env['DB_PASSWORD'] ?? '';
const database = process.env['DB_NAME'] ?? '';

const userInfo = password ? `${user}:${password}` : user;
const url = `postgresql://${userInfo}@${host}:${port}/${database}`;

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
