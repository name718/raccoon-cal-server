import { type IRouter, Router } from 'express';
import { authenticateToken } from '@/middleware/auth.middleware';
import { PetController } from '@/controllers/pet.controller';

const router: IRouter = Router();

/**
 * @route GET /api/pet
 * @desc 获取宠物状态（含心情计算，Redis 缓存 10 分钟）
 * @access Private
 */
router.get('/', authenticateToken, PetController.getStatus);

/**
 * @route POST /api/pet/interact
 * @desc 与宠物互动，授予 +10 XP（每日幂等）
 * @access Private
 */
router.post('/interact', authenticateToken, PetController.interact);

/**
 * @route PUT /api/pet/outfit
 * @desc 更新宠物装扮槽位（hat/clothes/accessory）
 * @access Private
 */
router.put('/outfit', authenticateToken, PetController.updateOutfit);

/**
 * @route GET /api/pet/outfits
 * @desc 获取已解锁装扮 key 列表
 * @access Private
 */
router.get('/outfits', authenticateToken, PetController.getOutfits);

export default router;
