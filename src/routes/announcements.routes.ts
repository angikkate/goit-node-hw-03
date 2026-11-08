import { Router } from 'express';
import { z } from 'zod';
import { registry, jsonResponse, errorResponse, validationResponse, AnnouncementSchema, AnnouncementsListSchema } from '../openapi';
import { list, getOne, create, update, remove } from '../controllers/announcements.controller';
import { authenticate } from '../middleware/authenticate';
import { uploadImage } from '../middleware/upload';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import {
  CATEGORIES,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  idParamsSchema,
  listQuerySchema,
} from '../validators/announcements.validator';

const router = Router();

router.get('/', validateQuery(listQuerySchema), list);
router.get('/:id', validateParams(idParamsSchema), getOne);
router.post('/', authenticate, uploadImage, validateBody(createAnnouncementSchema), create);
router.patch('/:id', authenticate, validateParams(idParamsSchema), uploadImage, validateBody(updateAnnouncementSchema), update);
router.delete('/:id', authenticate, validateParams(idParamsSchema), remove);

export default router;

// ---------- OpenAPI документація ----------
const bearer = [{ bearerAuth: [] }];
const unauthorized = errorResponse('Missing, invalid or expired access token');
const forbidden = errorResponse('Access denied (not your announcement)');
const notFound = errorResponse('Announcement not found');
const uploadFailed = errorResponse('Failed to upload image to Cloudinary');

const fieldsDoc = z.object({
  title: z.string().min(5).max(50),
  description: z.string().min(10).max(2000),
  price: z.number().positive(),
  category: CATEGORIES,
});

const imageDoc = z.string().openapi({
  type: 'string',
  format: 'binary',
  description: 'Image file: JPEG, PNG, WebP or GIF, up to 5 MB',
});

const createMultipartDoc = fieldsDoc.extend({ image: imageDoc.optional() });
const updateMultipartDoc = fieldsDoc.partial().extend({ image: imageDoc.optional() });

registry.registerPath({
  method: 'get',
  path: '/announcements',
  tags: ['Announcements'],
  summary: 'List announcements (pagination, search by title, sorting)',
  request: { query: listQuerySchema },
  responses: {
    200: jsonResponse('Page of announcements', AnnouncementsListSchema),
    400: validationResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/announcements/{id}',
  tags: ['Announcements'],
  summary: 'Get one announcement',
  request: { params: idParamsSchema },
  responses: {
    200: jsonResponse('Announcement', AnnouncementSchema),
    400: validationResponse,
    404: notFound,
  },
});

registry.registerPath({
  method: 'post',
  path: '/announcements',
  tags: ['Announcements'],
  summary: 'Create an announcement (optionally with a photo)',
  description: 'Send multipart/form-data to attach a photo in the "image" field. Plain JSON without a photo is also accepted.',
  security: bearer,
  request: {
    body: {
      required: true,
      content: {
        'multipart/form-data': { schema: createMultipartDoc },
        'application/json': { schema: fieldsDoc },
      },
    },
  },
  responses: {
    201: jsonResponse('Announcement created', AnnouncementSchema),
    400: validationResponse,
    401: unauthorized,
    502: uploadFailed,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/announcements/{id}',
  tags: ['Announcements'],
  summary: 'Update your announcement (partial, optionally with a new photo)',
  description: 'At least one field or an image is required. Send multipart/form-data to replace the photo.',
  security: bearer,
  request: {
    params: idParamsSchema,
    body: {
      required: true,
      content: {
        'multipart/form-data': { schema: updateMultipartDoc },
        'application/json': { schema: fieldsDoc.partial() },
      },
    },
  },
  responses: {
    200: jsonResponse('Announcement updated', AnnouncementSchema),
    400: validationResponse,
    401: unauthorized,
    403: forbidden,
    404: notFound,
    502: uploadFailed,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/announcements/{id}',
  tags: ['Announcements'],
  summary: 'Delete your announcement',
  security: bearer,
  request: { params: idParamsSchema },
  responses: {
    204: { description: 'Announcement deleted' },
    400: validationResponse,
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});
