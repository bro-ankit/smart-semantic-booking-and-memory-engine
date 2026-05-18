import { registerAs } from '@nestjs/config';

export const DATABASE_CONFIG = 'DATABASE' as const;

export type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  poolSize: number;
};

export default registerAs(DATABASE_CONFIG, (): DatabaseConfig => ({
  host: process.env['POSTGRES_HOST'] ?? 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10),
  user: process.env['POSTGRES_USER'] ?? '',
  password: process.env['POSTGRES_PASSWORD'] ?? '',
  database: process.env['POSTGRES_DB'] ?? '',
  poolSize: parseInt(process.env['DB_POOL_SIZE'] ?? '10', 10),
}));
