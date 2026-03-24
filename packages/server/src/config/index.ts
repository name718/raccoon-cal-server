import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',

  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
  },

  database: {
    url:
      process.env.DATABASE_URL ||
      'mysql://raccoon_user:password@localhost:3306/raccoon_cal',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  },

  upload: {
    provider: process.env.UPLOAD_PROVIDER || 'local',
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10), // 5MB
    allowedTypes: (
      process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp'
    ).split(','),
  },

  obs: {
    accessKeyId: process.env.OBS_ACCESS_KEY_ID,
    secretAccessKey: process.env.OBS_SECRET_ACCESS_KEY,
    server: process.env.OBS_SERVER,
    bucket: process.env.OBS_BUCKET,
    publicBaseUrl: process.env.OBS_PUBLIC_BASE_URL,
    keyPrefix: process.env.OBS_KEY_PREFIX || 'raccoon-cal',
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    s3Bucket: process.env.AWS_S3_BUCKET,
  },

  ai: {
    provider:
      process.env.AI_PROVIDER ||
      (process.env.BAIDU_AI_API_KEY && process.env.BAIDU_AI_SECRET_KEY
        ? 'baidu'
        : 'logmeal'),
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '10000', 10),
    logmeal: {
      apiKey: process.env.AI_API_KEY,
      apiUrl: process.env.AI_API_URL || 'https://api.logmeal.es',
    },
    baidu: {
      appId: process.env.BAIDU_AI_APP_ID,
      apiKey: process.env.BAIDU_AI_API_KEY,
      secretKey: process.env.BAIDU_AI_SECRET_KEY,
      oauthUrl:
        process.env.BAIDU_AI_OAUTH_URL ||
        'https://aip.baidubce.com/oauth/2.0/token',
      dishUrl:
        process.env.BAIDU_AI_DISH_URL ||
        'https://aip.baidubce.com/rest/2.0/image-classify/v2/dish',
      topNum: parseInt(process.env.BAIDU_AI_TOP_NUM || '3', 10),
      filterThreshold: process.env.BAIDU_AI_FILTER_THRESHOLD || '0.7',
      baikeNum: parseInt(process.env.BAIDU_AI_BAIKE_NUM || '0', 10),
    },
  },

  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },
};
