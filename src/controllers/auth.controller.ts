import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { prisma } from '../../prisma/client';
import { config } from '../config';
import { getUserId } from '../middleware/authenticate';

// Дані користувача, які можна віддавати клієнту (без password)
function publicUser(user: { id: number; username: string; email: string; name: string }) {
  return { id: user.id, username: user.username, email: user.email, name: user.name };
}

export function generateTokens(userId: number) {
  const accessToken = jwt.sign({ sub: String(userId) }, config.jwtSecret, {
    expiresIn: '15m',
  });
  // jwtid робить кожен refresh token унікальним, навіть якщо їх створено в одну секунду
  const refreshToken = jwt.sign({ sub: String(userId) }, config.jwtRefreshSecret, {
    expiresIn: '7d',
    jwtid: randomUUID(),
  });
  return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { username, email, password, name } = req.body;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) {
    res.status(409).json({ message: 'Username or email already taken' });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, password: hashedPassword, name },
  });

  const tokens = generateTokens(user.id);
  await prisma.refreshToken.create({
    data: { token: tokens.refreshToken, userId: user.id },
  });

  res.status(201).json({ user: publicUser(user), ...tokens });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;

  const user = await prisma.user.findUnique({ where: { username } });
  const passwordValid = user ? await bcrypt.compare(password, user.password) : false;

  // Однакове повідомлення в обох випадках, щоб не підказувати зловмиснику, що саме невірне
  if (!user || !passwordValid) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const tokens = generateTokens(user.id);

  // Старий refresh token замінюється новим
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    prisma.refreshToken.create({ data: { token: tokens.refreshToken, userId: user.id } }),
  ]);

  res.json({ user: publicUser(user), ...tokens });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;

  // 1. Перевіряємо підпис і термін дії
  try {
    jwt.verify(refreshToken, config.jwtRefreshSecret);
  } catch {
    res.status(401).json({ message: 'Invalid refresh token' });
    return;
  }

  // 2. Токен має існувати в базі
  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored) {
    res.status(401).json({ message: 'Invalid refresh token' });
    return;
  }

  // 3. Token rotation: старий видаляємо, новий записуємо.
  // deleteMany + count захищає від повторного використання одного токена двома запитами одночасно
  const deleted = await prisma.refreshToken.deleteMany({ where: { id: stored.id } });
  if (deleted.count === 0) {
    res.status(401).json({ message: 'Invalid refresh token' });
    return;
  }

  const tokens = generateTokens(stored.userId);
  await prisma.refreshToken.create({
    data: { token: tokens.refreshToken, userId: stored.userId },
  });

  res.json(tokens);
}

export async function logout(req: Request, res: Response): Promise<void> {
  // deleteMany не кидає помилку, якщо токена вже немає
  await prisma.refreshToken.deleteMany({ where: { userId: getUserId(req) } });
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: getUserId(req) },
    select: { id: true, username: true, email: true, name: true, createdAt: true },
  });

  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.json(user);
}
