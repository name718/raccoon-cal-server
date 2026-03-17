import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/types';
import {
  checkAndUnlockAchievements,
  getAchievements,
} from '@/services/achievement.service';
import { ApiResponse } from '@/utils/response';

export class AchievementController {
  /**
   * GET /api/achievements
   * 获取全部成就定义及当前用户解锁状态
   */
  static async getAchievements(
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

      // 先检查并解锁满足条件的成就（幂等）
      await checkAndUnlockAchievements(userId);

      const achievements = await getAchievements(userId);
      ApiResponse.success(res, achievements, '获取成就列表成功');
    } catch (err) {
      next(err);
    }
  }
}
