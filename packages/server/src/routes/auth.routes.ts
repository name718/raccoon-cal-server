import { type IRouter, Router } from 'express';
import { AuthController } from '@/controllers/auth.controller';
import { validateRequest } from '@/middleware/validation';
import { authenticateToken } from '@/middleware/auth.middleware';
import { loginValidator, registerValidator } from '@/validators/auth.validator';

const router: IRouter = Router();

/**
 * @route POST /api/auth/register
 * @desc 用户注册
 * @access Public
 */
router.post(
  '/register',
  validateRequest(registerValidator),
  AuthController.register
);

/**
 * @route POST /api/auth/login
 * @desc 用户登录
 * @access Public
 */
router.post('/login', validateRequest(loginValidator), AuthController.login);

/**
 * @route GET /api/auth/me
 * @desc 获取当前用户信息
 * @access Private
 */
router.get('/me', authenticateToken, AuthController.me);

export default router;
