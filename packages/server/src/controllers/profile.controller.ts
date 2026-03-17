import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/types';
import {
  getProfile,
  getWeightHistory,
  recordWeight,
  updateProfile,
  type UpdateProfileInput,
} from '@/services/profile.service';
import { ApiResponse } from '@/utils/response';

export class ProfileController {
  /**
   * GET /api/profile
   * 获取当前用户个人资料
   */
  static async getProfile(
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

      const profile = await getProfile(userId);
      if (!profile) {
        ApiResponse.error(res, 'PROFILE_NOT_FOUND', '个人资料不存在', 404);
        return;
      }

      ApiResponse.success(res, profile, '获取个人资料成功');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/profile
   * 更新当前用户个人资料（触发卡路里目标重算）
   */
  static async updateProfile(
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

      const data: UpdateProfileInput = req.body;
      const updated = await updateProfile(userId, data);
      ApiResponse.success(res, updated, '个人资料更新成功');
    } catch (err) {
      if ((err as Error).message === 'PROFILE_NOT_FOUND') {
        ApiResponse.error(res, 'PROFILE_NOT_FOUND', '个人资料不存在', 404);
        return;
      }
      next(err);
    }
  }

  /**
   * POST /api/profile/weight
   * 记录新体重（同步更新档案并重算卡路里目标）
   */
  static async recordWeight(
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

      const { weight } = req.body as { weight: number };
      if (typeof weight !== 'number' || weight <= 0) {
        ApiResponse.error(res, 'INVALID_WEIGHT', '体重必须为正数', 400);
        return;
      }

      const record = await recordWeight(userId, weight);
      ApiResponse.success(res, record, '体重记录成功');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/profile/weight-history
   * 获取体重历史记录（降序）
   */
  static async getWeightHistory(
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

      const history = await getWeightHistory(userId);
      ApiResponse.success(res, history, '获取体重历史成功');
    } catch (err) {
      next(err);
    }
  }
}
