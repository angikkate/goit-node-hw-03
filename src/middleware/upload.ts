import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config';

// Некоректний формат файлу (400)
export class UploadError extends Error {}
// Помилка завантаження на Cloudinary (відповідаємо 502)
export class PhotoUploadError extends Error {}

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

// Розширення беремо з типу файлу, а не з назви, яку надіслав клієнт
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXTENSIONS[file.mimetype] ?? ''}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in EXTENSIONS) {
      cb(null, true);
    } else {
      cb(new UploadError('Only JPEG, PNG, WebP and GIF images are allowed'));
    }
  },
});

const singleImage = upload.single('image');

// Приймає multipart/form-data з необов'язковим полем "image".
// JSON-запити multer просто пропускає далі.
export function uploadImage(req: Request, res: Response, next: NextFunction): void {
  // Видаляємо тимчасовий файл при завершенні або обриві запиту
  res.on('close', () => {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
  });
  singleImage(req, res, next);
}

// Завантажує файл на Cloudinary, повертає URL і в будь-якому випадку видаляє локальний файл
export async function uploadToCloudinary(filePath: string): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'announcements',
      resource_type: 'image',
    });
    return result.secure_url;
  } finally {
    await fs.promises.unlink(filePath).catch(() => {});
  }
}
