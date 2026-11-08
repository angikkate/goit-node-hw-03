import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Додає метод .openapi() до Zod-схем
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Схема авторизації: у Swagger UI з'являється кнопка "Authorize" і замочки на маршрутах
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// ---------- Спільні схеми відповідей ----------
export const UserSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  email: z.string(),
  name: z.string(),
});

export const ProfileSchema = UserSchema.extend({
  createdAt: z.string().datetime(),
});

export const TokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const AuthResponseSchema = TokensSchema.extend({
  user: UserSchema,
});

export const AnnouncementSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  description: z.string(),
  price: z.number().positive(),
  category: z.string(),
  imageUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  user: UserSchema,
});

export const AnnouncementsListSchema = z.object({
  data: z.array(AnnouncementSchema),
  pagination: z.object({
    total: z.number().int(),
    page: z.number().int(),
    totalPages: z.number().int(),
    perPage: z.number().int(),
  }),
});

export const ErrorSchema = z.object({
  message: z.string(),
});

export const ValidationErrorSchema = z.object({
  message: z.string(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })),
});

// Скорочення для опису відповідей у registerPath
export function jsonResponse(description: string, schema: z.ZodTypeAny) {
  return { description, content: { 'application/json': { schema } } };
}

export const errorResponse = (description: string) => jsonResponse(description, ErrorSchema);
export const validationResponse = jsonResponse('Validation error', ValidationErrorSchema);

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Announcements API',
      version: '1.0.0',
      description: 'JSON API дошки оголошень (JWT + refresh tokens)',
    },
    servers: [{ url: 'http://localhost:3000' }],
  });
}
