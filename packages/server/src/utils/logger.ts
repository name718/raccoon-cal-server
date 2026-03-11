import winston from 'winston';
import path from 'path';
import { config } from '@/config';

// 创建日志目录
const logDir = path.dirname(config.log.file);

const logger = winston.createLogger({
  level: config.log.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'raccoon-cal-server' },
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: config.log.file,
    }),
  ],
});

// 开发环境下同时输出到控制台
if (config.env !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export { logger };
