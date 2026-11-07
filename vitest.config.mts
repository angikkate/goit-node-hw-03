// Достатньо експортувати об'єкт, імпорт defineConfig не обов'язковий
export default {
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Тестові значення змінних оточення (справжній .env тестам не потрібен)
    env: {
      JWT_SECRET: 'test_access_secret',
      JWT_REFRESH_SECRET: 'test_refresh_secret',
      CLOUDINARY_CLOUD_NAME: 'test',
      CLOUDINARY_API_KEY: 'test',
      CLOUDINARY_API_SECRET: 'test',
      ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:3000',
    },
  },
};
