import pino from 'pino';

const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: isTest ? 'silent' : 'info',
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  
  transport: isTest || isProduction ? undefined : { target: 'pino-pretty' },
});

export default logger;
