import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may contain only letters, digits and underscores'),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  // bcrypt обробляє максимум 72 байти, тому довший пароль не має сенсу
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(72, 'Password must be at most 72 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name must be at most 50 characters'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
