import { z } from 'zod';

export const CATEGORIES = z.enum(['sale', 'service', 'job', 'other']);

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(50, 'Title must be at most 50 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be at most 2000 characters'),
  price: z.number().positive(),
  category: CATEGORIES,
});

// Усі поля опціональні, але порожній об'єкт {} не дозволений
export const updateAnnouncementSchema = createAnnouncementSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
});

export type IdParams = z.infer<typeof idParamsSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
