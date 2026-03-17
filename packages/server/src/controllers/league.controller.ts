import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/types';
import { getLeagueInfo, getLeagueSettlement } from '@/services/league.service';
import { ApiResponse } from '@/utils/response';

export class LeagueController {
  /**
   * GET /api/league
   * 获取用户当前联盟信息和排行榜
   */
  static async getLeagueCurrent(
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

      const leagueInfo = await getLeagueInfo(userId);
      ApiResponse.success(res, leagueInfo, '获取联盟信息成功');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/league/settlement
   * 获取用户上次联盟结算结果
   */
  static async getLeagueSettlement(
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

      const settlement = await getLeagueSettlement(userId);
      if (settlement === null) {
        ApiResponse.success(res, null, '暂无结算记录');
        return;
      }

      ApiResponse.success(res, settlement, '获取结算记录成功');
    } catch (err) {
      next(err);
    }
  }
}
