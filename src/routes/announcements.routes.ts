import { Router } from 'express';
import { registry, jsonResponse, errorResponse, validationResponse, AnnouncementSchema, AnnouncementsListSchema } from '../openapi';
import { list, getOne, create, update, remove } from '../controllers/announcements.controller';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  idParamsSchema,
  listQuerySchema,
} from '../validators/announcements.validator';

const router = Router();

router.get('/', validateQuery(listQuerySchema), list);
router.get('/:id', validateParams(idParamsSchema), getOne);
router.post('/', authenticate, validateBody(createAnnouncementSchema), create);
router.patch('/:id', authenticate, validateParams(idParamsSchema), validateBody(updateAnnouncementSchema), update);
router.delete('/:id', authenticate, validateParams(idParamsSchema), remove);

export default router;

// ---------- OpenAPI документація ----------
const bearer = [{ bearerAuth: [] }];
const unauthorized = errorResponse('Missing, invalid or expired access token');
const forbidden = errorResponse('Access denied (not your announcement)');
const notFound = errorResponse('Announcement not found');

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
  summary: 'Create an announcement',
  security: bearer,
  request: { body: { required: true, content: { 'application/json': { schema: createAnnouncementSchema } } } },
  responses: {
    201: jsonResponse('Announcement created', AnnouncementSchema),
    400: validationResponse,
    401: unauthorized,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/announcements/{id}',
  tags: ['Announcements'],
  summary: 'Update your announcement (partial)',
  security: bearer,
  request: {
    params: idParamsSchema,
    body: { required: true, content: { 'application/json': { schema: updateAnnouncementSchema } } },
  },
  responses: {
    200: jsonResponse('Announcement updated', AnnouncementSchema),
    400: validationResponse,
    401: unauthorized,
    403: forbidden,
    404: notFound,
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
