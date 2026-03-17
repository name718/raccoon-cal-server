import { type IRouter, Router } from 'express';
import { authenticateToken } from '@/middleware/auth.middleware';
import { GamificationController } from '@/controllers/gamification.controller';

const router: IRouter = Router();

/**
 * @route GET /api/gamification/status
 * @desc 获取用户游戏化状态（等级、XP、HP、连签等）
 * @access Private
 */
router.get('/status', authenticateToken, GamificationController.getStatus);

/**
 * @route GET /api/gamification/history
 * @desc 获取用户 XP 流水历史（最近 50 条）
 * @access Private
 */
router.get('/history', authenticateToken, GamificationController.getHistory);

export default router;
