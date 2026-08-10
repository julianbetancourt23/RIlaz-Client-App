/**
 * Tiny JSON-file store for the mock/preview phase.
 * TODO(SAP): replace with MySQL (customers table) when the real SAP provider
 * is wired — see ../SAP_INTEGRATION.md §6.2. Documents then live in SAP itself.
 */
import fs from 'fs';
import path from 'path';

import { ENV } from '../config/env';
import type { Db } from '../types';
import { buildSeed } from './seed';

let db: Db | null = null;

export function getDb(): Db {
  if (db) return db;
  if (fs.existsSync(ENV.DB_FILE)) {
    db = JSON.parse(fs.readFileSync(ENV.DB_FILE, 'utf8')) as Db;
  } else {
    db = buildSeed();
    persist();
    console.log(`[store] Base de datos inicial creada en ${ENV.DB_FILE} (3 clientes demo, contraseña 000000)`);
  }
  return db;
}

export function persist(): void {
  if (!db) return;
  fs.mkdirSync(path.dirname(ENV.DB_FILE), { recursive: true });
  const tmp = `${ENV.DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, ENV.DB_FILE);
}

export function nextFolio(kind: 'eq' | 'sv' | 'ct'): string {
  const d = getDb();
  d.counters[kind] += 1;
  const prefix = kind === 'eq' ? 'EQ' : kind === 'sv' ? 'SV' : 'CT';
  return `${prefix}-${new Date().getFullYear()}-${String(d.counters[kind]).padStart(4, '0')}`;
}
