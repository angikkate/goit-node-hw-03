import rateLimit from 'express-rate-limit';

// Не більше `limit` запитів з однієї IP за 15 хвилин
export function createRateLimiter(limit = 10) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later' },
  });
}

export const authRateLimiter = createRateLimiter(10);
