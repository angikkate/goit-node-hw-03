import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthPayload {
  sub: string; // id користувача (JWT вимагає, щоб sub був рядком)
  iat?: number;
  exp?: number;
}

// Module augmentation: додаємо req.user до типу Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization token required' });
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === 'string' || !payload.sub) {
      throw new Error('Invalid payload');
    }
    req.user = payload as AuthPayload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// id поточного користувача як число (використовувати лише після authenticate)
export function getUserId(req: Request): number {
  return Number(req.user!.sub);
}
