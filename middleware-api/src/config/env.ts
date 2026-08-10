import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const bool = (v: string | undefined, fallback: boolean) =>
  v === undefined ? fallback : v.toLowerCase() === 'true';

export const ENV = {
  PORT: Number(process.env.PORT ?? 3001),
  USE_MOCK_SAP: bool(process.env.USE_MOCK_SAP, true),
  SAP_BASE_URL: process.env.SAP_BASE_URL ?? 'https://192.168.1.30:50000/b1s/v1/',
  SAP_COMPANY_DB: process.env.SAP_COMPANY_DB ?? '',
  SAP_USERNAME: process.env.SAP_USERNAME ?? '',
  SAP_PASSWORD: process.env.SAP_PASSWORD ?? '',
  // Dev fallback only — set a real secret in .env before any deployment.
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-only-rilaz-customer-mw',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION ?? '30d',
  IT_PASSWORD: process.env.IT_PASSWORD ?? '000000',
  DB_FILE: path.resolve(__dirname, '..', '..', 'data', 'db.json'),
};

if (!process.env.JWT_SECRET) {
  console.warn('[env] JWT_SECRET no definido — usando valor de desarrollo. Configúralo en .env antes de desplegar.');
}
