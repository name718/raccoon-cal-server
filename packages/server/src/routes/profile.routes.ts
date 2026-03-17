import { type IRouter, Router } from 'express';
import { authenticateToken } from '@/middleware/auth.middleware';
import { ProfileController } from '@/controllers/profile.controller';

const router: IRouter = Router();

/**
 * @route GET /api/profile
 * @desc 获取当前用户个人资料
 * @access Private
 */
router.get('/', authenticateToken, ProfileController.getProfile);

/**
 * @route PUT /api/profile
 * @desc 更新个人资料（触发卡路里目标重算）
 * @access Private
 */
router.put('/', authenticateToken, ProfileController.updateProfile);

/**
 * @route GET /api/profile/weight-history
 * @desc 获取体重历史记录
 * @access Private
 */
router.get(
  '/weight-history',
  authenticateToken,
  ProfileController.getWeightHistory
);

/**
 * @route POST /api/profile/weight
 * @desc 记录新体重
 * @access Private
 */
router.post('/weight', authenticateToken, ProfileController.recordWeight);

export default router;
