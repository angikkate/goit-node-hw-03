# REST API Дошки оголошень

REST API для дошки оголошень з JWT-автентифікацією, авторизацією, контролем доступу, завантаженням фотографій, логуванням, комплексною безпекою та автотестами.

## Загальний опис

Чистий JSON API без рендерингу HTML. Бекенд обслуговує клієнтів (React-застосунки, мобільні додатки тощо) через HTTP-запити.

Користувачі можуть публікувати, редагувати та видаляти власні оголошення. Анонімні відвідувачі бачать список оголошень і можуть переглядати деталі. Для створення оголошення потрібна реєстрація. Редагувати та видаляти можна лише власні оголошення.

Автентифікація — JWT з refresh токенами. Access token: 15 хвилин, refresh token: 7 днів. Token rotation для refresh токенів.

У версії HW-03 реалізовано покращення для production-середовища:
- **Базова безпека:** Helmet (HTTP-заголовки), CORS (обмеження по `ALLOWED_ORIGINS`), Rate Limiting (макс 10 запитів/15 хв на авторизацію).
- **Логування:** `pino` та `pino-http` для HTTP-запитів і контролерів.
- **Фото оголошень:** Тимчасове збереження через `multer` + завантаження на `Cloudinary` з автоматичним видаленням локального файлу.
- **Тестування:** Набір Unit та Integration тестів на `Vitest` та `Supertest`.

## Технологічний стек

| Технологія                     | Опис                                        |
| ------------------------------ | ------------------------------------------- |
| Node.js                        | Середовище виконання                        |
| Express 5                      | Веб-фреймворк                               |
| Prisma 7                       | ORM для бази даних (PostgreSQL)             |
| Zod                            | Валідація вхідних даних                     |
| bcrypt / bcryptjs              | Хешування паролів                           |
| jsonwebtoken                   | JWT-автентифікація                          |
| Helmet                         | Захист HTTP-заголовків                      |
| cors                           | Налаштування Cross-Origin Resource Sharing  |
| express-rate-limit             | Обмеження кількості запитів (Rate Limiting) |
| Pino / Pino-HTTP               | Структуроване логування                     |
| Multer & Cloudinary            | Обробка та хмарне збереження зображень      |
| Vitest & Supertest             | Тестовий фреймворк та інструмент для API    |
| @asteasolutions/zod-to-openapi | Генерація OpenAPI документації              |
| swagger-ui-express             | Swagger UI                                  |
| dotenv                         | Змінні середовища                           |

## Встановлення

1. Встановіть залежності:

```bash
npm install
```

2. Створіть файл конфігурації:

```bash
cp .env.example .env
```

3. Налаштуйте `.env`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/announcements?schema=public
JWT_SECRET=your-secret-key-at-least-256-bits-long
JWT_REFRESH_SECRET=your-refresh-secret-key
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

4. Застосуйте міграцію:

```bash
npm run prisma:migrate
```

5. Запустіть проект:

```bash
npm run dev
```

## Маршрути

### Auth

| Метод | Шлях             | Опис                          | Auth |
| ----- | ---------------- | ----------------------------- | ---- |
| POST  | `/auth/register` | Реєстрація користувача        | Ні   |
| POST  | `/auth/login`    | Вхід користувача              | Ні   |
| POST  | `/auth/refresh`  | Оновлення токенів             | Ні   |
| POST  | `/auth/logout`   | Вихід                         | Ні   |
| GET   | `/auth/me`       | Профіль поточного користувача | Так  |

### Оголошення

| Метод  | Шлях                 | Опис                                      | Auth |    Body Type   |
| ------ | -------------------- | ----------------------------------------- | ---- | -------------- |
| GET    | `/announcements`     | Список з пагінацією, пошуком, сортуванням | Ні   |       --       |
| GET    | `/announcements/:id` | Деталі оголошення                         | Ні   |       --       |
| POST   | `/announcements`     | Створення оголошення                      | Так  | multipart/form |
| PATCH  | `/announcements/:id` | Часткове оновлення (власне)               | Так  |       --       |
| DELETE | `/announcements/:id` | Видалення (власне)                        | Так  |       --       |

## Параметри запитів

### GET /announcements

| Параметр | Тип   | Опис                                            |
| -------- | ----- | ----------------------------------------------- |
| `search` | query | Пошук по назві (нечутливий до регістру)         |
| `sort`   | query | `newest` (за замовчуванням) або `oldest`        |
| `page`   | query | Номер сторінки (число > 0), 10 записів/сторінка |

### POST /auth/register

| Поле       | Вимоги                                  |
| ---------- | --------------------------------------- |
| `username` | рядок, обов'язковий, 3–30 символів      |
| `email`    | email, обов'язковий                     |
| `password` | рядок, обов'язковий, мінімум 6 символів |
| `name`     | рядок, обов'язковий, мінімум 2 символи  |

### POST /announcements

| Поле          | Вимоги                                                 |
| ------------- | ------------------------------------------------------ |
| `title`       | рядок, обов'язковий, 5–50 символів                     |
| `description` | рядок, обов'язковий, мінімум 10 символів               |
| `price`       | число, обов'язкове, > 0                                |
| `category`    | рядок, обов'язковий: `sale`, `service`, `job`, `other` |
| `image`       | файл зображення (JPEG, PNG, WebP, GIF), макс 5 MB      |

PATCH використовує ті ж правила валідації, але всі поля опціональні (хоча б одне має бути присутнє).

## Структура проекту

```
goit-node-hw-03/
├── prisma/
│   ├── schema.prisma
│   ├── client.ts
│   └── migrations/
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   └── announcements.controller.ts
│   ├── middleware/
│   │   ├── authenticate.ts
│   │   ├── rateLimit.ts
│   │   ├── upload.ts
│   │   ├── validate.ts
│   │   └── cors.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   └── announcements.routes.ts
│   ├── validators/
│   │   ├── auth.validator.ts
│   │   └── announcements.validator.ts
│   |── config.ts
│   ├── logger.ts
│   └── openapi.ts
├── tests/
│   └── auth.test.ts
├── uploads/
├── app.ts
├── vitest.config.mts
├── .env.example
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

## Бойлерплейт

Мінімальний стартовий набір:

- `package.json` з усіма залежностями
- `tsconfig.json` з налаштуваннями TypeScript
- `src/openapi.ts` з ініціалізованим registry та `bearerAuth`
- `prisma/client.ts` з ініціалізованим Prisma Client (PostgreSQL через `@prisma/adapter-pg`)
- `prisma.config.ts` з конфігурацією Prisma
- `.env.example` з шаблоном змінних середовища

## Доступні скрипти

| Команда                   | Опис                                 |
| ------------------------- | ------------------------------------ |
| `npm run dev`             | Запуск з hot reload (`node --watch`) |
| `npm start`               | Запуск у виробничому режимі          |
| `npm test`                | Запуск автоматичних тестів (Vitest)  |
| `npm run prisma:migrate`  | Створення та застосування міграцій   |
| `npm run prisma:generate` | Генерація Prisma Client              |
| `npm run prisma:studio`   | Запуск графічного інтерфейсу Prisma  |

## Документація API

Swagger UI доступний за адресою: http://localhost:3000/api-docs

## Prisma schema

Три моделі: `User`, `RefreshToken`, `Announcement`.

- `User` — `username` (унікальний), хешований `password`, `email` (унікальний), `name`, `createdAt`
- `RefreshToken` — `token` (унікальний), зв'язок з `User`
- `Announcement` — `title`, `description`, `price`, `category`, `imageUrl`, зв'язок з `User`, `createdAt`, `updatedAt`

## Ліцензія

ISC
