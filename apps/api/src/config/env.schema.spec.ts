import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema';

const validConfig = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5433/db',
  JWT_ACCESS_SECRET: 'a'.repeat(16),
  JWT_REFRESH_SECRET: 'b'.repeat(16),
};

describe('validateEnv', () => {
  it('accepts a minimal valid config and applies defaults', () => {
    const env = validateEnv(validConfig);
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
  });

  it('throws a readable error when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _drop, ...rest } = validConfig;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('throws when a JWT secret is too short', () => {
    expect(() => validateEnv({ ...validConfig, JWT_ACCESS_SECRET: 'short' })).toThrow();
  });

  it('defaults GUEST_TOKEN_TTL to 12h', () => {
    expect(validateEnv(validConfig).GUEST_TOKEN_TTL).toBe('12h');
  });

  it('refuses the placeholder .env.example secret in production', () => {
    const prod = {
      ...validConfig,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'change-me-access-secret-min-16-chars',
    };
    expect(() => validateEnv(prod)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('accepts a real secret in production and the placeholder in development', () => {
    expect(() => validateEnv({ ...validConfig, NODE_ENV: 'production' })).not.toThrow();
    expect(() =>
      validateEnv({ ...validConfig, JWT_ACCESS_SECRET: 'change-me-access-secret-min-16-chars' }),
    ).not.toThrow();
  });
});
