import { type IRouter, Router } from 'express';
import { authenticateToken } from '@/middleware/auth.middleware';
import { TaskController } from '@/controllers/task.controller';

const router: IRouter = Router();

/**
 * @route GET /api/tasks/daily
 * @desc 获取当日任务列表（若无则自动生成）
 * @access Private
 */
router.get('/daily', authenticateToken, TaskController.getDailyTasks);

/**
 * @route POST /api/tasks/:id/complete
 * @desc 手动完成指定任务，授予对应 XP
 * @access Private
 */
router.post('/:id/complete', authenticateToken, TaskController.completeTask);

export default router;
