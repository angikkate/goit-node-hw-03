import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';

function formatErrors(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

function sendValidationError(res: Response, error: ZodError) {
  res.status(400).json({ message: 'Validation error', errors: formatErrors(error) });
}

// Перевіряє тіло запиту. Після перевірки req.body містить очищені дані.
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      sendValidationError(res, result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}

// Перевіряє параметри шляху. Готові дані (id вже числом) лежать у res.locals.params.
export function validateParams(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      sendValidationError(res, result.error);
      return;
    }
    res.locals.params = result.data;
    next();
  };
}

// Перевіряє query-параметри. Готові дані (зі значеннями за замовчуванням) лежать у res.locals.query.
export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      sendValidationError(res, result.error);
      return;
    }
    res.locals.query = result.data;
    next();
  };
}
