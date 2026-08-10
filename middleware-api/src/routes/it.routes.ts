/**
 * Panel IT endpoints (public/panel_it.html). Simple password login → 'it' JWT.
 */
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';

import { ENV } from '../config/env';
import { itAuth } from '../middleware/auth';
import { getSapProvider } from '../providers/factory';
import { getDb, persist } from '../store/jsonStore';
import type { Customer, DocumentKind, DocumentStatus } from '../types';

export const itRouter = Router();

itRouter.post('/login', (req, res) => {
  const { password } = req.body ?? {};
  if (typeof password !== 'string' || password !== ENV.IT_PASSWORD) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  const token = jwt.sign({ role: 'it' }, ENV.JWT_SECRET, { expiresIn: '12h' });
  return res.json({ token });
});

itRouter.use(itAuth);

itRouter.get('/stats', async (_req, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  res.json({
    clientes: db.customers.filter((c) => c.isActive).length,
    pedidos: db.documents.filter((d) => d.kind === 'eq').length,
    servicios: db.documents.filter((d) => d.kind === 'sv').length,
    cotizaciones: db.documents.filter((d) => d.kind === 'ct').length,
    nuevos: db.documents.filter((d) => d.status === 'nuevo').length,
    hoy: db.documents.filter((d) => d.createdAt.slice(0, 10) === today).length,
    sap: await getSapProvider().healthCheck(),
  });
});

// ---- Clientes ----

const publicCustomer = (c: Customer) => ({
  id: c.id,
  email: c.email,
  cardCode: c.cardCode,
  name: c.name,
  company: c.company,
  phone: c.phone ?? '',
  isActive: c.isActive,
  machines: c.machines,
  locations: c.locations,
  createdAt: c.createdAt,
  lastLogin: c.lastLogin,
});

itRouter.get('/customers', (_req, res) => {
  res.json(getDb().customers.map(publicCustomer));
});

itRouter.post('/customers', (req, res) => {
  const { email, password, cardCode, name, company, phone } = req.body ?? {};
  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Correo inválido' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  const db = getDb();
  if (db.customers.some((c) => c.email.toLowerCase() === email.trim().toLowerCase())) {
    return res.status(409).json({ error: 'Ya existe un cliente con ese correo' });
  }
  const customer: Customer = {
    id: `c-${Date.now()}`,
    email: email.trim().toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    cardCode: typeof cardCode === 'string' ? cardCode.trim() : '',
    name: typeof name === 'string' ? name.trim() : '',
    company: typeof company === 'string' ? company.trim() : '',
    phone: typeof phone === 'string' ? phone.trim() : '',
    isActive: true,
    machines: [],
    locations: [],
    createdAt: new Date().toISOString(),
    lastLogin: null,
  };
  db.customers.push(customer);
  persist();
  return res.status(201).json(publicCustomer(customer));
});

itRouter.patch('/customers/:id', (req, res) => {
  const customer = getDb().customers.find((c) => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

  const { isActive, password, name, company, cardCode, phone } = req.body ?? {};
  if (typeof isActive === 'boolean') customer.isActive = isActive;
  if (typeof password === 'string') {
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    customer.passwordHash = bcrypt.hashSync(password, 10);
  }
  if (typeof name === 'string') customer.name = name.trim();
  if (typeof company === 'string') customer.company = company.trim();
  if (typeof cardCode === 'string') customer.cardCode = cardCode.trim();
  if (typeof phone === 'string') customer.phone = phone.trim();
  persist();
  return res.json(publicCustomer(customer));
});

// ---- Documentos (pedidos, servicios, cotizaciones) ----

itRouter.get('/documents', (req, res) => {
  const { kind, status } = req.query;
  let docs = [...getDb().documents];
  if (kind === 'eq' || kind === 'sv' || kind === 'ct') {
    docs = docs.filter((d) => d.kind === (kind as DocumentKind));
  }
  if (status === 'nuevo' || status === 'procesado') {
    docs = docs.filter((d) => d.status === (status as DocumentStatus));
  }
  docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(docs);
});

itRouter.patch('/documents/:id', (req, res) => {
  const doc = getDb().documents.find((d) => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
  const { status } = req.body ?? {};
  if (status !== 'nuevo' && status !== 'procesado') {
    return res.status(400).json({ error: 'Estado inválido (nuevo/procesado)' });
  }
  doc.status = status;
  persist();
  return res.json(doc);
});

// ---- Catálogo (toggle de stock para simular disponibilidad) ----

itRouter.get('/catalog', async (_req, res) => {
  res.json(await getSapProvider().getCatalog());
});

itRouter.patch('/catalog/:itemId', (req, res) => {
  const { inStock } = req.body ?? {};
  if (typeof inStock !== 'boolean') {
    return res.status(400).json({ error: 'inStock (boolean) es requerido' });
  }
  getDb().catalogStock[req.params.itemId] = inStock;
  persist();
  return res.json({ itemId: req.params.itemId, inStock });
});
