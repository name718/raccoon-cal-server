import { type IRouter, Router } from 'express';
import { authenticateToken } from '@/middleware/auth.middleware';
import { AchievementController } from '@/controllers/achievement.controller';

const router: IRouter = Router();

/**
 * @route GET /api/achievements
 * @desc 获取全部成就定义及当前用户解锁状态（自动检查并解锁满足条件的成就）
 * @access Private
 */
router.get('/', authenticateToken, AchievementController.getAchievements);

export default router;
