import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/types';
import {
  getGamificationStatus,
  getXpHistory,
} from '@/services/gamification.service';
import { ApiResponse } from '@/utils/response';

export class GamificationController {
  /**
   * GET /api/gamification/status
   * 获取用户游戏化状态
   */
  static async getStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponse.error(res, 'AUTH_REQUIRED', '需要登录认证', 401);
        return;
      }

      const status = await getGamificationStatus(userId);
      ApiResponse.success(res, status, '获取游戏化状态成功');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/gamification/history
   * 获取用户 XP 流水历史
   */
  static async getHistory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponse.error(res, 'AUTH_REQUIRED', '需要登录认证', 401);
        return;
      }

      const history = await getXpHistory(userId);
      ApiResponse.success(res, history, '获取 XP 历史成功');
    } catch (err) {
      next(err);
    }
  }
}
