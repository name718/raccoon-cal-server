import type { Application } from 'express';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { database } from '@/config/database';
import { errorHandler } from '@/middleware/errorHandler';
import { notFoundHandler } from '@/middleware/notFoundHandler';
import { requestLogger } from '@/middleware/requestLogger';

const app: Application = express();

// 安全中间件
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// 请求限制
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// 基础中间件
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// 健康检查
app.get('/health', async (req, res) => {
  const dbHealth = await database.healthCheck();

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbHealth ? 'connected' : 'disconnected',
  });
});

// API 路由
import authRoutes from '@/routes/auth.routes';
import captchaRoutes from '@/routes/captcha.routes';
import foodRoutes from '@/routes/food.routes';
import gamificationRoutes from '@/routes/gamification.routes';
import petRoutes from '@/routes/pet.routes';
import taskRoutes from '@/routes/task.routes';
import achievementRoutes from '@/routes/achievement.routes';
import leagueRoutes from '@/routes/league.routes';
import profileRoutes from '@/routes/profile.routes';

app.use('/api/auth', authRoutes);
app.use('/api/captcha', captchaRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/pet', petRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/league', leagueRoutes);
app.use('/api/profile', profileRoutes);

app.use('/api', (req, res) => {
  res.status(200).json({
    message: 'Raccoon Cal Server API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// 错误处理中间件
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.server.port;
const HOST = config.server.host;

// 启动服务器
async function startServer() {
  try {
    // 连接数据库
    await database.connect();

    // 启动 HTTP 服务器
    app.listen(PORT, HOST, () => {
      logger.info(`Server is running on http://${HOST}:${PORT}`);
      logger.info(`Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await database.disconnect();
  process.exit(0);
});

startServer();

export default app;
