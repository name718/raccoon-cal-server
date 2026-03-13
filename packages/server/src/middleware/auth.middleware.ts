import type { NextFunction, Request, Response } from 'express';
import { AuthService } from '@/services/auth.service';
import { ApiResponse } from '@/utils/response';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    email?: string | null;
    phone?: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
  };
}

/**
 * JWT认证中间件
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.get('authorization');
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      ApiResponse.error(res, 'AUTH_REQUIRED', '需要登录认证', 401);
      return;
    }

    const user = await AuthService.verifyToken(token);
    (req as AuthenticatedRequest).user = user;

    next();
  } catch (error: unknown) {
    ApiResponse.error(res, 'INVALID_TOKEN', 'Token无效或已过期', 401);
  }
};

/**
 * 可选认证中间件（不强制要求登录）
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.get('authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const user = await AuthService.verifyToken(token);
      (req as AuthenticatedRequest).user = user;
    }

    next();
  } catch (error: unknown) {
    // 可选认证失败时不返回错误，继续执行
    next();
  }
};
