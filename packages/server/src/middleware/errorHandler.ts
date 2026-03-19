import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { config } from '@/config';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let { statusCode = 500, message } = err;

  // 记录错误日志
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Prisma 错误处理
  if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database operation failed';
  }

  if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Request data is invalid';
  }

  // JWT 错误处理
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // 验证错误处理
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
  }

  // 生产环境下不暴露详细错误信息
  if (config.env === 'production' && statusCode === 500) {
    message = 'Internal server error';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.name || 'UNKNOWN_ERROR',
      message,
    },
    timestamp: new Date().toISOString(),
  });
};
