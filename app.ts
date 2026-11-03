import { config } from './src/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { Prisma } from '@prisma/client';
import authRoutes from './src/routes/auth.routes';
import announcementsRoutes from './src/routes/announcements.routes';
import { generateOpenApiDocument } from './src/openapi';

const app = express();

app.use(cors());
app.use(express.json());

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

  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`🚀 Server running on http://localhost:${config.port}`);
  console.log(`📘 API docs: http://localhost:${config.port}/api-docs`);
});
