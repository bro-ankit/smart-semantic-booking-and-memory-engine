import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const host = process.env['DB.HOST'] ?? 'localhost';
const port = process.env['DB.PORT'] ?? '5432';
const user = process.env['DB.USER'] ?? '';
const password = process.env['DB.PASSWORD'] ?? '';
const database = process.env['DB.NAME'] ?? '';

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
