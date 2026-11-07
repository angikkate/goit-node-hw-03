import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Підміняємо Prisma, щоб тести працювали без бази даних
vi.mock('../prisma/client', () => ({
  prisma: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    refreshToken: { create: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import app from '../app';
import { prisma } from '../prisma/client';
import { config } from '../src/config';
import { generateTokens } from '../src/controllers/auth.controller';
import { createRateLimiter } from '../src/middleware/rateLimit';

const db = prisma as any; // моки мають методи mockResolvedValue тощо

const validUser = {
  username: 'ivan_petrenko',
  email: 'ivan@example.com',
  password: 'secret123',
  name: 'Іван',
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------- Unit-тести ----------
describe('generateTokens', () => {
  it('створює access і refresh токени з id користувача в sub', () => {
    const { accessToken, refreshToken } = generateTokens(42);

    const access = jwt.verify(accessToken, config.jwtSecret) as jwt.JwtPayload;
    const refresh = jwt.verify(refreshToken, config.jwtRefreshSecret) as jwt.JwtPayload;

    expect(access.sub).toBe('42');
    expect(refresh.sub).toBe('42');
    // access живе 15 хвилин, refresh — 7 днів
    expect(access.exp! - access.iat!).toBe(15 * 60);
    expect(refresh.exp! - refresh.iat!).toBe(7 * 24 * 60 * 60);
  });

  it('кожен refresh token унікальний, навіть при двох викликах поспіль', () => {
    const first = generateTokens(1).refreshToken;
    const second = generateTokens(1).refreshToken;
    expect(first).not.toBe(second);
  });
});

describe('хешування паролів', () => {
  it('bcrypt-хеш не дорівнює паролю, але проходить перевірку', async () => {
    const hash = await bcrypt.hash('secret123', 4);

    expect(hash).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', hash)).toBe(true);
    expect(await bcrypt.compare('wrong', hash)).toBe(false);
  });
});

// ---------- Integration-тести ----------
// Усього до /auth робиться менше 10 запитів, тому rate limiter (10 за 15 хв) не заважає.
describe('POST /auth/register', () => {
  it('повертає 201, токени і не повертає password', async () => {
    db.user.findFirst.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: 1, ...validUser, password: 'hashed', createdAt: new Date() });
    db.refreshToken.create.mockResolvedValue({});

    const res = await request(app).post('/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: 1, username: 'ivan_petrenko', email: 'ivan@example.com', name: 'Іван' });
    expect(res.body.user.password).toBeUndefined();
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');

    // у базу пішов bcrypt-хеш, а не відкритий пароль
    const savedPassword = db.user.create.mock.calls[0][0].data.password;
    expect(savedPassword).not.toBe('secret123');
    expect(savedPassword.startsWith('$2')).toBe(true);
  });

  it('повертає 409, якщо username або email зайнятий', async () => {
    db.user.findFirst.mockResolvedValue({ id: 1 });

    const res = await request(app).post('/auth/register').send(validUser);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Username or email already taken');
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('повертає 400 при невалідному email', async () => {
    const res = await request(app).post('/auth/register').send({ ...validUser, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('email');
  });
});

describe('POST /auth/login', () => {
  const storedUser = { id: 1, ...validUser, password: bcrypt.hashSync('secret123', 4) };

  it('повертає 401 при невірному паролі', async () => {
    db.user.findUnique.mockResolvedValue(storedUser);

    const res = await request(app).post('/auth/login').send({ username: 'ivan_petrenko', password: 'wrong_password' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('повертає те саме повідомлення, якщо користувача не існує', async () => {
    db.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/auth/login').send({ username: 'nobody', password: 'secret123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('повертає 200 і токени при вірних даних', async () => {
    db.user.findUnique.mockResolvedValue(storedUser);
    db.$transaction.mockResolvedValue([]);

    const res = await request(app).post('/auth/login').send({ username: 'ivan_petrenko', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
  });
});

// ---------- Захист ----------
describe('захищені маршрути', () => {
  it('POST /announcements без токена повертає 401', async () => {
    const res = await request(app).post('/announcements').send({});
    expect(res.status).toBe(401);
  });
});

describe('безпека', () => {
  it('helmet додає безпечні заголовки', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('CORS пропускає дозволений origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('CORS відхиляє недозволений origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://evil.example.com');

    expect(res.status).toBe(403);
  });

  it('rate limiter повертає 429 після перевищення ліміту', async () => {
    const limited = express();
    limited.use(createRateLimiter(2));
    limited.get('/', (_req, res) => res.json({ ok: true }));

    await request(limited).get('/').expect(200);
    await request(limited).get('/').expect(200);
    const res = await request(limited).get('/');

    expect(res.status).toBe(429);
    expect(res.body.message).toBe('Too many requests, please try again later');
  });
});
