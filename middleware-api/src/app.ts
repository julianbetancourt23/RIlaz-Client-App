import path from 'path';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';

import { getSapProvider } from './providers/factory';
import { appRouter } from './routes/app.routes';
import { authRouter } from './routes/auth.routes';
import { itRouter } from './routes/it.routes';

export function createApp() {
  const app = express();

  // Dev preview: la app (Expo web/nativo) y el panel corren en orígenes variados.
  // TODO(prod): restringir a los orígenes reales (SAP_INTEGRATION.md §8).
  app.use(cors());
  app.use(express.json());

  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });

  app.get('/health', async (_req, res) => {
    res.json({ service: 'rilaz-customer-middleware', ...(await getSapProvider().healthCheck()) });
  });

  app.use('/auth', authRouter);
  app.use('/it', itRouter);
  app.use('/', appRouter);

  // Panel IT
  app.use(express.static(path.resolve(__dirname, '..', 'public')));
  app.get('/', (_req, res) => res.redirect('/panel_it.html'));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[error]', err);
    res.status(status).json({ error: err.message || 'Error interno' });
  });

  return app;
}
