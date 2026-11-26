/**
 * Centralised, validated configuration (12-factor style).
 * Every setting comes from environment variables so the same build runs
 * locally, in CI and in production with different settings.
 */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // "mongo" in dev/prod. "memory" gives a throwaway in-process store for tests and demos.
  DATA_STORE: z.enum(['mongo', 'memory']).default('mongo'),
  MONGODB_URI: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  // Proxies in front of the API: 1 = Render only, 2 = Vercel then Render. Used to find each user's real IP for rate limiting.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  // External web services
  USDA_API_KEY: z.string().default('DEMO_KEY'),
  USDA_API_URL: z.string().url().default('https://api.nal.usda.gov/fdc/v1'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-haiku-5-5'),
  // Development/test only: emails that are given the admin role on registration
  ADMIN_EMAILS: z.string().default(''),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  SERVE_CLIENT: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
});

export function loadConfig(overrides = {}) {
  const parsed = schema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  const cfg = parsed.data;

  if (cfg.NODE_ENV === 'production') {
    if (!cfg.JWT_SECRET) throw new Error('JWT_SECRET is required in production');
    if (cfg.DATA_STORE === 'mongo' && !cfg.MONGODB_URI) {
      throw new Error('MONGODB_URI is required when DATA_STORE=mongo');
    }
  }
  // Dev/test fallback secret so the app boots without setup; never used in production.
  if (!cfg.JWT_SECRET) cfg.JWT_SECRET = 'dev-only-insecure-secret-change-me-0123456789';

  cfg.isProd = cfg.NODE_ENV === 'production';
  cfg.adminEmails = cfg.ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Object.freeze(cfg);
}
