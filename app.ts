import { config } from './src/config';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import multer from 'multer';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { Prisma } from '@prisma/client';
import logger from './src/logger';
import { corsMiddleware, CorsError } from './src/middleware/cors';
import { UploadError, PhotoUploadError } from './src/middleware/upload';
import authRoutes from './src/routes/auth.routes';
import announcementsRoutes from './src/routes/announcements.routes';
import { generateOpenApiDocument } from './src/openapi';

const app = express();

// Кожен HTTP-запит логується автоматично (сторінку документації пропускаємо, щоб не засмічувати лог)
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => Boolean(req.url?.startsWith('/api-docs')) },
  }),
);

// Безпечні HTTP-заголовки для всіх маршрутів.
// upgrade-insecure-requests вимкнено, бо на http://localhost він ламає Swagger UI.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'upgrade-insecure-requests': null,
      },
    },
  }),
);

app.use(corsMiddleware);
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/announcements', announcementsRoutes);

// Документація: усі registerPath вже виконані при імпорті маршрутів вище
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(generateOpenApiDocument()));

// Невідомий маршрут
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

// Глобальний обробник помилок (Express 5 передає сюди й помилки з async-функцій)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof CorsError) {
    res.status(403).json({ message: 'Origin not allowed by CORS' });
    return;
  }

  // Помилки multer: завеликий файл, невідоме поле тощо
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large (max 5 MB)'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Unexpected file field, use "image" with a single file'
          : err.message;
    res.status(400).json({ message });
    return;
  }
  if (err instanceof UploadError) {
    res.status(400).json({ message: err.message });
    return;
  }
  if (err instanceof PhotoUploadError) {
    res.status(502).json({ message: err.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2025 — запис для update/delete не знайдено
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }
    // P2002 — порушення унікальності (наприклад, одночасна реєстрація з тим самим username)
    if (err.code === 'P2002') {
      res.status(409).json({ message: 'Resource already exists' });
      return;
    }
  }

  // Некоректний JSON у тілі запиту
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    res.status(400).json({ message: 'Invalid JSON body' });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ message: 'Internal server error' });
});

// У тестах сервер не запускаємо: supertest сам піднімає app на вільному порту
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    logger.info(`Server running on http://localhost:${config.port}`);
    logger.info(`API docs: http://localhost:${config.port}/api-docs`);
  });
}

export default app;