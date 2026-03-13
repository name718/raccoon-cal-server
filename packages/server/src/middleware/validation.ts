import type { NextFunction, Request, Response } from 'express';
import type { Schema } from 'joi';
import { ApiResponse } from '@/utils/response';

/**
 * 请求验证中间件
 */
export const validateRequest = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // 返回所有验证错误
      stripUnknown: true, // 移除未知字段
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      ApiResponse.error(res, 'VALIDATION_ERROR', '请求参数验证失败', 400, {
        errors,
      });
      return;
    }

    // 使用验证后的数据替换原始数据
    req.body = value;
    next();
  };
};
