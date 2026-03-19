import type { NextFunction, Response } from 'express';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedRequest } from '@/types';
import {
  deleteFoodRecord,
  getFoodRecords,
  getNutritionStats,
  saveFoodRecord,
  type SaveFoodRecordInput,
} from '@/services/food.service';
import { recognizeFood } from '@/services/logmeal.service';
import { ApiResponse } from '@/utils/response';

type MulterRequest = AuthenticatedRequest & { file?: Express.Multer.File };

export class FoodController {
  private static imageExtension(file: Express.Multer.File): string {
    const byMimeType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };

    const mapped = byMimeType[file.mimetype];
    if (mapped) {
      return mapped;
    }

    const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
    return ext || 'jpg';
  }

  /**
   * POST /api/food/recognize
   * 上传图片，调用 LogMeal 识别食物
   */
  static async recognize(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const file = (req as MulterRequest).file;

      if (!file) {
        ApiResponse.error(res, 'INVALID_IMAGE', '请上传图片文件', 400);
        return;
      }

      const result = await recognizeFood(file.buffer);
      ApiResponse.success(res, result, '食物识别成功');
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'AI_TIMEOUT') {
        ApiResponse.error(
          res,
          'AI_TIMEOUT',
          'AI 识别服务超时，请稍后重试',
          503
        );
        return;
      }
      next(err);
    }
  }

  /**
   * POST /api/food/records
   * 保存一条饮食记录
   */
  static async createRecord(
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

      const body = req.body as SaveFoodRecordInput & { recordedAt?: string };

      const input: SaveFoodRecordInput = {
        foodName: body.foodName,
        calories: body.calories,
        protein: body.protein,
        fat: body.fat,
        carbs: body.carbs,
        fiber: body.fiber,
        servingSize: body.servingSize,
        mealType: body.mealType,
        imageUrl: body.imageUrl,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
      };

      const record = await saveFoodRecord(userId, input);
      ApiResponse.success(res, record, '饮食记录保存成功', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/food/uploads
   * 上传饮食记录图片并返回可访问地址
   */
  static async uploadRecordImage(
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

      const file = (req as MulterRequest).file;
      if (!file) {
        ApiResponse.error(res, 'INVALID_IMAGE', '请上传图片文件', 400);
        return;
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'food-records');
      await mkdir(uploadDir, { recursive: true });

      const filename = `food-${userId}-${Date.now()}-${randomUUID()}.${FoodController.imageExtension(file)}`;
      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, file.buffer);

      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/food-records/${filename}`;
      ApiResponse.success(res, { imageUrl }, '图片上传成功', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/food/records?date=YYYY-MM-DD
   * 获取饮食记录（可按日期过滤）
   */
  static async getRecords(
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

      const date = req.query.date as string | undefined;
      const records = await getFoodRecords(userId, date);
      ApiResponse.success(res, records, '获取饮食记录成功');
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/food/records/:id
   * 删除一条饮食记录
   */
  static async deleteRecord(
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

      const recordId = parseInt(req.params.id, 10);
      if (isNaN(recordId)) {
        ApiResponse.error(res, 'INVALID_ID', '无效的记录 ID', 400);
        return;
      }

      await deleteFoodRecord(userId, recordId);
      ApiResponse.success(res, null, '饮食记录删除成功');
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'RECORD_NOT_FOUND') {
        ApiResponse.error(res, 'RECORD_NOT_FOUND', '饮食记录不存在', 404);
        return;
      }
      if (error.code === 'FORBIDDEN') {
        ApiResponse.error(res, 'FORBIDDEN', '无权删除该记录', 403);
        return;
      }
      next(err);
    }
  }

  /**
   * GET /api/food/stats?days=7
   * 获取 N 天营养统计
   */
  static async getStats(
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

      const days = parseInt((req.query.days as string) ?? '7', 10);
      if (isNaN(days) || days < 1 || days > 365) {
        ApiResponse.error(
          res,
          'INVALID_DAYS',
          'days 参数须为 1-365 的整数',
          400
        );
        return;
      }

      const stats = await getNutritionStats(userId, days);
      ApiResponse.success(res, stats, '获取营养统计成功');
    } catch (err) {
      next(err);
    }
  }
}
