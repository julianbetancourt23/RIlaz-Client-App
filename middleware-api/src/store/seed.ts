/**
 * First-boot seed. The three customers mirror the app's mock users
 * (Source/src/data/users.ts) so the same demo credentials keep working:
 * password 000000 for all. CardCodes are placeholders until SAP is wired.
 */
import bcrypt from 'bcryptjs';

import type { Db } from '../types';

export function buildSeed(): Db {
  const hash = bcrypt.hashSync('000000', 10);
  const now = new Date().toISOString();

  return {
    counters: { eq: 413, sv: 89, ct: 100 },
    catalogStock: {},
    customers: [
      {
        id: 'c-admin',
        email: 'admin@rilaz.com.sv',
        passwordHash: hash,
        cardCode: 'C10000',
        name: 'Admin',
        company: 'Rilaz S.A de C.V',
        isActive: true,
        machines: [],
        locations: [],
        createdAt: now,
        lastLogin: null,
      },
      {
        id: 'c-julian',
        email: 'julian.betancourt@rilaz.com.sv',
        passwordHash: hash,
        cardCode: 'C20000',
        name: 'Julián Betancourt',
        company: 'Grupo Betana',
        isActive: true,
        machines: [],
        locations: [],
        createdAt: now,
        lastLogin: null,
      },
      {
        id: 'c-elroble',
        email: 'compras@elroble.sv',
        passwordHash: hash,
        cardCode: 'C30000',
        name: 'Julián',
        company: 'Distribuidora El Roble',
        phone: '7712-3456',
        isActive: true,
        machines: [
          { id: 'm1', model: 'Brother MFC-L2750DW', serial: 'U6392-1', info: 'Recepción' },
          { id: 'm2', model: 'Brother HL-L8360CDW', serial: 'U6392-2', info: 'Contabilidad' },
        ],
        locations: [{ id: 'l1', label: 'Ubicación 1', address: 'Col. Escalón, San Salvador' }],
        createdAt: now,
        lastLogin: null,
      },
    ],
    documents: [
      {
        id: 'd-seed-1',
        kind: 'eq',
        folio: 'EQ-2026-0412',
        status: 'procesado',
        customerId: 'c-elroble',
        cardCode: 'C30000',
        company: 'Distribuidora El Roble',
        createdAt: '2026-06-28T14:30:00.000Z',
        lines: [
          { itemId: 't2', name: 'Tóner negro — Estándar', sku: 'Lexmark 56F4000', unit: 'unidad', qty: 2, unitPrice: 96.0 },
          { itemId: 'p1', name: 'Papel bond Carta · 75g', sku: 'PP-CARTA75', unit: 'resma', qty: 10, unitPrice: 4.9 },
        ],
        total: 241.0,
        deliveryAddress: 'Col. Escalón, San Salvador',
      },
      {
        id: 'd-seed-2',
        kind: 'sv',
        folio: 'SV-2026-0088',
        status: 'procesado',
        customerId: 'c-elroble',
        cardCode: 'C30000',
        company: 'Distribuidora El Roble',
        createdAt: '2026-07-02T09:15:00.000Z',
        machine: { id: 'm1', model: 'Brother MFC-L2750DW', serial: 'U6392-1' },
        problem: 'Atasco de papel',
        urgency: 'Media',
        description: 'El equipo de recepción atasca el papel al imprimir por ambas caras.',
      },
    ],
  };
}
