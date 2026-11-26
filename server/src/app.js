/**
 * Express application factory. Dependencies (config, repositories, external
 * clients) are injected, so tests can build an app with an in-memory store
 * and fake APIs, while production wires in MongoDB and the real services.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { securityHeaders, stripMongoOperators, requireCsrfHeader, apiLimiter } from './middleware/security.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { profileRouter } from './routes/profile.routes.js';
import {
  dailyRouter,
  scheduleRouter,
  workoutsRouter,
  mealsRouter,
  waterRouter,
  measurementsRouter,
} from './routes/tracking.routes.js';
import { coachRouter, progressRouter, exportRouter } from './routes/insights.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { createDayDataService } from './services/dayData.service.js';
import { createNutritionService } from './services/nutrition/index.js';
import { createUsdaClient } from './services/nutrition/usdaClient.js';
import { createCoachService } from './services/coach/index.js';
import { createAiCoach } from './services/coach/aiCoach.js';
import { createProgressService } from './services/progress.service.js';

export function createApp({ config, repos, usda, aiCoach, healthCheck = async () => true }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY); // proxies in front of us (Render = 1, Vercel + Render = 2): real client IPs for rate limiting

  // ---- services (composition root) ----
  const dayData = createDayDataService(repos);
  const nutrition = createNutritionService({
    usda: usda === undefined ? createUsdaClient({ apiKey: config.USDA_API_KEY, baseUrl: config.USDA_API_URL }) : usda,
  });
  const ai = aiCoach !== undefined ? aiCoach : config.ANTHROPIC_API_KEY ? createAiCoach({ apiKey: config.ANTHROPIC_API_KEY, model: config.ANTHROPIC_MODEL }) : null;
  const coach = createCoachService({ repos, dayData, aiCoach: ai });
  const progress = createProgressService({ repos, dayData });
  const deps = { repos, config, dayData, nutrition, coach, progress };

  // ---- global middleware ----
  app.use(securityHeaders());
  app.use(compression());
  if (config.NODE_ENV !== 'test') app.use(morgan(config.isProd ? 'combined' : 'dev'));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.CLIENT_ORIGIN.split(',').includes(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(stripMongoOperators);

  // ---- API ----
  const api = express.Router();
  api.get('/health', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const db = await healthCheck().catch(() => false);
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db, time: new Date().toISOString() });
  });
  api.use(apiLimiter(config));
  api.use(requireCsrfHeader);
  api.use('/auth', authRouter(deps));

  const auth = requireAuth(deps);
  api.use('/profile', auth, profileRouter(deps));
  api.use('/daily', auth, dailyRouter(deps));
  api.use('/schedule', auth, scheduleRouter(deps));
  api.use('/workouts', auth, workoutsRouter(deps));
  api.use('/meals', auth, mealsRouter(deps));
  api.use('/water', auth, waterRouter(deps));
  api.use('/measurements', auth, measurementsRouter(deps));
  api.use('/coach', auth, coachRouter(deps));
  api.use('/progress', auth, progressRouter(deps));
  api.use('/export', auth, exportRouter(deps));
  api.use('/admin', auth, adminRouter(deps));
  api.use(notFoundHandler);
  app.use('/api', api);

  // ---- React front end (single deployable unit, same origin = simpler, safer cookies) ----
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (config.SERVE_CLIENT && fs.existsSync(clientDist)) {
    // Hashed build assets can be cached forever; other files (manifest, icons) for a day
    app.use('/assets', express.static(path.join(clientDist, 'assets'), { maxAge: '1y', immutable: true }));
    app.use(express.static(clientDist, { index: false, maxAge: '1d' }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler(config));
  return app;
}
