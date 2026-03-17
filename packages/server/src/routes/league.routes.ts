import { type IRouter, Router } from 'express';
import { authenticateToken } from '@/middleware/auth.middleware';
import { LeagueController } from '@/controllers/league.controller';

const router: IRouter = Router();

/**
 * @route GET /api/league/current
 * @desc 获取用户当前联盟信息和排行榜
 * @access Private
 */
router.get('/current', authenticateToken, LeagueController.getLeagueCurrent);

/**
 * @route GET /api/league/settlement
 * @desc 获取用户上次联盟结算结果
 * @access Private
 */
router.get(
  '/settlement',
  authenticateToken,
  LeagueController.getLeagueSettlement
);

export default router;
