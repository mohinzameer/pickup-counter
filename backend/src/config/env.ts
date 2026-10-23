import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const WEBHOOK_SECRET = required('WEBHOOK_SECRET');

// OWASP: refuse to boot in production with a well-known default secret.
if (NODE_ENV === 'production' && /change-?me|dev-secret/i.test(WEBHOOK_SECRET)) {
  throw new Error('Refusing to start: WEBHOOK_SECRET looks like a default value in production');
}

export const env = {
  NODE_ENV,
  DATABASE_URL: required('DATABASE_URL'),
  WEBHOOK_SECRET,
  HOLD_SECONDS: Math.max(1, Math.min(3600, Number(process.env.HOLD_SECONDS ?? 120))),
  PORT: Number(process.env.PORT ?? 3000),
};