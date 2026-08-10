import os from 'os';

import { createApp } from './app';
import { ENV } from './config/env';
import { getDb } from './store/jsonStore';

getDb(); // inicializa/siembra data/db.json en el primer arranque

const app = createApp();

app.listen(ENV.PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const lan = Object.values(nets)
    .flat()
    .find((n) => n && n.family === 'IPv4' && !n.internal);
  console.log('──────────────────────────────────────────────');
  console.log('  RILAZ — Middleware de clientes (modo MOCK)');
  console.log(`  Local:    http://localhost:${ENV.PORT}`);
  if (lan) console.log(`  LAN:      http://${lan.address}:${ENV.PORT}  ← usar esta IP en la app`);
  console.log(`  Panel IT: http://localhost:${ENV.PORT}/panel_it.html`);
  console.log('──────────────────────────────────────────────');
});
