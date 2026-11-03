import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { getUserId } from '../middleware/authenticate';
import { IdParams, ListQuery } from '../validators/announcements.validator';

const PER_PAGE = 10;

// Які поля повертаємо клієнту (userId не показуємо, замість нього — об'єкт user без password)
const announcementSelect = {
  id: true,
  title: true,
  description: true,
  price: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, username: true, email: true, name: true } },
} satisfies Prisma.AnnouncementSelect;

export async function list(_req: Request, res: Response): Promise<void> {
  const { search, sort, page } = res.locals.query as ListQuery;

  // Порожній search = без фільтра. mode: 'insensitive' — пошук без урахування регістру
  const where: Prisma.AnnouncementWhereInput = search
    ? { title: { contains: search, mode: 'insensitive' } }
    : {};

  const direction = sort === 'oldest' ? 'asc' : 'desc';

  const [total, data] = await Promise.all([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({
      where,
      // id як другий критерій, щоб порядок на сторінках був стабільним
      orderBy: [{ createdAt: direction }, { id: direction }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: announcementSelect,
    }),
  ]);

  res.json({
    data,
    pagination: {
      total,
      page,
      totalPages: Math.ceil(total / PER_PAGE),
      perPage: PER_PAGE,
    },
  });
}

export async function getOne(_req: Request, res: Response): Promise<void> {
  const { id } = res.locals.params as IdParams;

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: announcementSelect,
  });

  // findUnique повертає null, тому 404 віддаємо самі
  if (!announcement) {
    res.status(404).json({ message: 'Announcement not found' });
    return;
  }

  res.json(announcement);
}

export async function create(req: Request, res: Response): Promise<void> {
  const { title, description, price, category } = req.body;

  const announcement = await prisma.announcement.create({
    // автор береться з токена, а не з тіла запиту
    data: { title, description, price, category, userId: getUserId(req) },
    select: announcementSelect,
  });

  res.status(201).json(announcement);
}

// Знаходить оголошення і перевіряє, що воно належить поточному користувачу.
// Якщо ні — сама відправляє 404/403 і повертає false.
async function checkOwnership(req: Request, res: Response, id: number): Promise<boolean> {
  const announcement = await prisma.announcement.findUnique({ where: { id } });

  if (!announcement) {
    res.status(404).json({ message: 'Announcement not found' });
    return false;
  }

  if (announcement.userId !== getUserId(req)) {
    res.status(403).json({ message: 'Access denied' });
    return false;
  }

  return true;
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = res.locals.params as IdParams;

  if (!(await checkOwnership(req, res, id))) {
    return;
  }

  const { title, description, price, category } = req.body;

  // updatedAt оновлюється автоматично завдяки @updatedAt у schema.prisma
  const announcement = await prisma.announcement.update({
    where: { id },
    data: { title, description, price, category },
    select: announcementSelect,
  });

  res.json(announcement);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = res.locals.params as IdParams;

  if (!(await checkOwnership(req, res, id))) {
    return;
  }

  await prisma.announcement.delete({ where: { id } });
  res.status(204).end();
}
