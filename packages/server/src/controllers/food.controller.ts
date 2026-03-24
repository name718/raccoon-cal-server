import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/types';
import {
  deleteFoodRecord,
  getFoodRecords,
  getNutritionStats,
  saveFoodRecord,
  type SaveFoodRecordInput,
} from '@/services/food.service';
import { recognizeFood } from '@/services/logmeal.service';
import {
  decodeObjectKey,
  getFoodRecordImage,
  resolveImageUrlThroughProxy,
  uploadFoodRecordImage,
} from '@/services/storage.service';
import { ApiResponse } from '@/utils/response';

type MulterRequest = AuthenticatedRequest & { file?: Express.Multer.File };

export class FoodController {
  /**
   * POST /api/food/recognize
   * 上传图片，通过服务端中转调用外部 AI 识别食物
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
      if (error.code === 'BAIDU_AI_AUTH_FAILED') {
        ApiResponse.error(
          res,
          'BAIDU_AI_AUTH_FAILED',
          '百度鉴权失败，请检查服务端配置的 API Key 和 Secret Key',
          502
        );
        return;
      }
      if (error.code === 'BAIDU_AI_CONFIG_MISSING') {
        ApiResponse.error(
          res,
          'BAIDU_AI_CONFIG_MISSING',
          '百度菜品识别配置不完整',
          500
        );
        return;
      }
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

      const requestOrigin = `${req.protocol}://${req.get('host')}`;
      const { imageUrl } = await uploadFoodRecordImage({
        buffer: file.buffer,
        contentType: file.mimetype,
        originalFilename: file.originalname,
        requestOrigin,
        folder: 'food-records',
        userId,
      });

      ApiResponse.success(res, { imageUrl }, '图片上传成功', 201);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'OBS_CONFIG_MISSING') {
        ApiResponse.error(
          res,
          'OBS_CONFIG_MISSING',
          error.message ?? 'OBS 配置不完整',
          500
        );
        return;
      }
      if (error.code === 'OBS_UPLOAD_FAILED') {
        ApiResponse.error(
          res,
          'OBS_UPLOAD_FAILED',
          error.message ?? 'OBS 上传失败',
          502
        );
        return;
      }
      next(err);
    }
  }

  /**
   * GET /media/:encodedKey
   * 通过服务端代理输出饮食记录图片
   */
  static async proxyRecordImage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const encodedKey = req.params.encodedKey;
      if (!encodedKey) {
        ApiResponse.error(res, 'INVALID_IMAGE_KEY', '图片标识不能为空', 400);
        return;
      }

      const objectKey = decodeObjectKey(encodedKey);
      if (!objectKey || objectKey.includes('..') || objectKey.startsWith('/')) {
        ApiResponse.error(res, 'INVALID_IMAGE_KEY', '图片标识无效', 400);
        return;
      }

      const image = await getFoodRecordImage(objectKey);
      res.setHeader('Content-Type', image.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      if (image.contentLength) {
        res.setHeader('Content-Length', String(image.contentLength));
      }
      res.status(200).send(image.body);
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException & { code?: string };
      if (error.code === 'ENOENT') {
        res.status(404).send('Image not found');
        return;
      }
      if (error.code === 'OBS_READ_FAILED') {
        res.status(502).send('Image unavailable');
        return;
      }
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
      const requestOrigin = `${req.protocol}://${req.get('host')}`;
      const records = await getFoodRecords(userId, date);
      ApiResponse.success(
        res,
        records.map(record => ({
          ...record,
          imageUrl: resolveImageUrlThroughProxy(record.imageUrl, requestOrigin),
        })),
        '获取饮食记录成功'
      );
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
