import { type IRouter, Router } from 'express';
import { CaptchaController } from '@/controllers/captcha.controller';
import { validateRequest } from '@/middleware/validation';
import { captchaVerifyValidator } from '@/validators/captcha.validator';

const router: IRouter = Router();

/**
 * @route GET /api/captcha/generate
 * @desc 生成图形验证码
 * @access Public
 */
router.get('/generate', CaptchaController.generateCaptcha);

/**
 * @route POST /api/captcha/verify
 * @desc 验证图形验证码
 * @access Public
 */
router.post(
  '/verify',
  validateRequest(captchaVerifyValidator),
  CaptchaController.verifyCaptcha
);

/**
 * @route GET /api/captcha/stats
 * @desc 获取验证码统计信息
 * @access Public
 */
router.get('/stats', CaptchaController.getCaptchaStats);

export default router;
