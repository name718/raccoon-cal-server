import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/types';
import {
  getPetLevelHistory,
  getPetStatus,
  getUnlockedOutfits,
  interactWithPet,
  type PetOutfitInput,
  updatePetOutfit,
} from '@/services/pet.service';
import { ApiResponse } from '@/utils/response';

export class PetController {
  /**
   * GET /api/pet
   * 获取宠物状态（含心情计算）
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

      const status = await getPetStatus(userId);
      ApiResponse.success(res, status, '获取宠物状态成功');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/pet/interact
   * 与宠物互动，授予 +10 XP（每日幂等）
   */
  static async interact(
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

      const result = await interactWithPet(userId);
      ApiResponse.success(res, result, '互动成功');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/pet/outfit
   * 更新宠物装扮槽位
   */
  static async updateOutfit(
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

      const outfit: PetOutfitInput = {
        hat: req.body.hat,
        clothes: req.body.clothes,
        accessory: req.body.accessory,
      };

      const status = await updatePetOutfit(userId, outfit);
      ApiResponse.success(res, status, '装扮更新成功');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/pet/level-history
   * 获取宠物升级历史（按 achievedAt 升序）
   */
  static async getLevelHistory(
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

      const history = await getPetLevelHistory(userId);
      ApiResponse.success(res, history, '获取升级历史成功');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/pet/outfits
   * 获取已解锁装扮列表
   */
  static async getOutfits(
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

      const outfits = await getUnlockedOutfits(userId);
      ApiResponse.success(res, { outfits }, '获取已解锁装扮成功');
    } catch (err) {
      next(err);
    }
  }
}
