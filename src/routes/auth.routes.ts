import { Router } from 'express';
import { registry, jsonResponse, errorResponse, validationResponse, AuthResponseSchema, TokensSchema, ProfileSchema } from '../openapi';
import { register, login, refresh, logout, me } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { authRateLimiter } from '../middleware/rateLimit';
import { validateBody } from '../middleware/validate';
import { registerSchema, loginSchema, refreshSchema } from '../validators/auth.validator';

const router = Router();

// Ліміт діє лише на auth-маршрути: 10 запитів за 15 хвилин з однієї IP
router.use(authRateLimiter);

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.post('/refresh', validateBody(refreshSchema), refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

export default router;

// ---------- OpenAPI документація ----------
const bearer = [{ bearerAuth: [] }];
const tooMany = errorResponse('Too many requests, please try again later');
const unauthorized = errorResponse('Missing, invalid or expired access token');

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: ['Auth'],
  summary: 'Register a new user',
  request: { body: { required: true, content: { 'application/json': { schema: registerSchema } } } },
  responses: {
    429: tooMany,
    201: jsonResponse('User created, tokens issued', AuthResponseSchema),
    400: validationResponse,
    409: errorResponse('Username or email already taken'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Log in',
  request: { body: { required: true, content: { 'application/json': { schema: loginSchema } } } },
  responses: {
    429: tooMany,
    200: jsonResponse('Logged in, new tokens issued', AuthResponseSchema),
    400: validationResponse,
    401: errorResponse('Invalid credentials'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: 'Get a new pair of tokens (token rotation)',
  request: { body: { required: true, content: { 'application/json': { schema: refreshSchema } } } },
  responses: {
    429: tooMany,
    200: jsonResponse('New pair of tokens', TokensSchema),
    400: validationResponse,
    401: errorResponse('Invalid refresh token'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Auth'],
  summary: 'Log out (invalidate refresh token)',
  security: bearer,
  responses: {
    429: tooMany,
    204: { description: 'Logged out' },
    401: unauthorized,
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Current user profile',
  security: bearer,
  responses: {
    429: tooMany,
    200: jsonResponse('Current user', ProfileSchema),
    401: unauthorized,
    404: errorResponse('User not found'),
  },
});
