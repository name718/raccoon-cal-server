import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/types';
import { checkAndCompleteTasks, getDailyTasks } from '@/services/task.service';
import { prisma } from '@/config/database';
import { awardXp } from '@/utils/gamificationEngine';
import { ApiResponse } from '@/utils/response';
import { logger } from '@/utils/logger';

export class TaskController {
  /**
   * GET /api/tasks/daily
   * 获取当日任务列表（若无则自动生成）
   */
  static async getDailyTasks(
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

      const date =
        typeof req.query.date === 'string' ? req.query.date : undefined;
      const result = await getDailyTasks(userId, date);
      ApiResponse.success(res, result, '获取每日任务成功');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/tasks/:id/complete
   * 手动完成指定任务，授予对应 XP
   */
  static async completeTask(
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

      const taskId = parseInt(req.params.id, 10);
      if (isNaN(taskId)) {
        ApiResponse.error(res, 'INVALID_PARAM', '无效的任务 ID', 400);
        return;
      }

      const task = await prisma.dailyTask.findFirst({
        where: { id: taskId, userId },
      });

      if (!task) {
        ApiResponse.error(res, 'NOT_FOUND', '任务不存在', 404);
        return;
      }

      if (task.completed) {
        ApiResponse.success(res, { alreadyCompleted: true }, '任务已完成');
        return;
      }

      await prisma.dailyTask.update({
        where: { id: taskId },
        data: { completed: true, completedAt: new Date() },
      });

      await awardXp(userId, 'task_complete', `task_${taskId}`, task.xpReward);

      // 检查全勤奖励
      await checkAndCompleteTasks(userId, task.taskDate);

      logger.info('task.controller: task manually completed', {
        userId,
        taskId,
      });

      ApiResponse.success(
        res,
        { taskId, xpAwarded: task.xpReward },
        '任务完成'
      );
    } catch (err) {
      next(err);
    }
  }
}
