import type { NextFunction, Request, Response } from 'express';
import { AuthService } from '@/services/auth.service';
import { ApiResponse } from '@/utils/response';
import type { LoginRequest, RegisterRequest } from '@/types/auth';
import type { AuthenticatedRequest } from '@/types';

export class AuthController {
  /**
   * 用户注册
   */
  static async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data: RegisterRequest = req.body;
      const result = await AuthService.register(data);

      ApiResponse.success(res, result, '注册成功', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 用户登录
   */
  static async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data: LoginRequest = req.body;
      const result = await AuthService.login(data);

      ApiResponse.success(res, result, '登录成功');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取当前用户信息
   */
  static async me(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user; // 从认证中间件获取

      ApiResponse.success(res, { user }, '获取用户信息成功');
    } catch (error: unknown) {
      next(error);
    }
  }
}
