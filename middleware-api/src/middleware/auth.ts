import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { ENV } from '../config/env';
import { getDb } from '../store/jsonStore';
import type { Customer } from '../types';

export type CustomerJwt = { sub: string; cardCode: string; role: 'customer' };
export type ItJwt = { role: 'it' };

declare module 'express-serve-static-core' {
  interface Request {
    customer?: Customer;
  }
}

const bearer = (req: Request): string | null => {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
};

/** App users: validates the customer JWT and attaches req.customer. */
export function customerAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET) as CustomerJwt;
    if (payload.role !== 'customer') throw new Error('rol inválido');
    const customer = getDb().customers.find((c) => c.id === payload.sub);
    if (!customer || !customer.isActive) {
      return res.status(401).json({ error: 'Cuenta inactiva o inexistente' });
    }
    req.customer = customer;
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

/** Panel IT: role 'it' token from POST /it/login. */
export function itAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET) as ItJwt;
    if (payload.role !== 'it') throw new Error('rol inválido');
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}
