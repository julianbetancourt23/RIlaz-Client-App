import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';

import { ENV } from '../config/env';
import { getSapProvider } from '../providers/factory';
import { getDb, persist } from '../store/jsonStore';
import type { AccountPayload } from '../types';

export const authRouter = Router();

/**
 * POST /auth/login {email, password} → {token, account}
 * `account` matches the app's UserAccount shape (Source/src/data/users.ts).
 */
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email y password son requeridos' });
  }
  const customer = getDb().customers.find(
    (c) => c.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!customer || !bcrypt.compareSync(password, customer.passwordHash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  if (!customer.isActive) {
    return res.status(403).json({ error: 'Cuenta desactivada — contacta a Rilaz' });
  }

  customer.lastLogin = new Date().toISOString();
  persist();

  const token = jwt.sign(
    { sub: customer.id, cardCode: customer.cardCode, role: 'customer' },
    ENV.JWT_SECRET,
    { expiresIn: ENV.JWT_EXPIRATION } as jwt.SignOptions,
  );

  const provider = getSapProvider();
  const account: AccountPayload = {
    id: customer.id,
    email: customer.email,
    password: '',
    name: customer.name,
    company: customer.company,
    phone: customer.phone,
    machines: await provider.getEquipment(customer),
    locations: customer.locations,
    recent: await provider.getRecentActivity(customer),
  };

  return res.json({ token, account });
});
