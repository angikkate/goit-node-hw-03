import cors from 'cors';
import { config } from '../config';

export class CorsError extends Error {}

// Дозволяє лише origins зі змінної ALLOWED_ORIGINS.
// Запити без заголовка Origin (curl, Postman, сервер-сервер) пропускаються: CORS — це захист браузера.
export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new CorsError(`Origin ${origin} is not allowed by CORS`));
  },
});
