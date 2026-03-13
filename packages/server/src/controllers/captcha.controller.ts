import type { NextFunction, Request, Response } from 'express';
import { CaptchaService } from '@/services/captcha.service';
import { ApiResponse } from '@/utils/response';
import type { CaptchaVerifyRequest } from '@/types/captcha';

export class CaptchaController {
  /**
   * 生成图形验证码
   */
  static async generateCaptcha(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = CaptchaService.generateCaptcha();

      ApiResponse.success(res, result, '验证码生成成功');
    } catch (error) {
      next(error);
    }
  }

  /**
   * 验证图形验证码
   */
  static async verifyCaptcha(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { captchaId, captchaCode }: CaptchaVerifyRequest = req.body;

      const isValid = CaptchaService.verifyCaptcha(captchaId, captchaCode);

      if (isValid) {
        ApiResponse.success(res, { valid: true }, '验证码验证成功');
      } else {
        ApiResponse.error(res, 'INVALID_CAPTCHA', '验证码错误或已过期', 400);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取验证码统计信息（用于监控）
   */
  static async getCaptchaStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const count = CaptchaService.getCaptchaCount();

      ApiResponse.success(
        res,
        {
          activeCaptchas: count,
          timestamp: new Date().toISOString(),
        },
        '获取验证码统计成功'
      );
    } catch (error) {
      next(error);
    }
  }
}
