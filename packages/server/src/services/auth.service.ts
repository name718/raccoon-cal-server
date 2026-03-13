import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '@/config';
import type { LoginRequest, RegisterRequest } from '@/types/auth';

const prisma = new PrismaClient();

export class AuthService {
  /**
   * 用户注册
   */
  static async register(data: RegisterRequest) {
    const { username, password, email, phone } = data;

    // TODO: 验证图形验证码
    // const isCaptchaValid = CaptchaService.verifyCaptcha(captchaId, captchaCode);
    // if (!isCaptchaValid) {
    //   throw new Error('验证码错误或已过期');
    // }

    // 检查用户名是否已存在
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new Error('用户名已存在');
      }
      if (existingUser.email === email) {
        throw new Error('邮箱已被注册');
      }
      if (existingUser.phone === phone) {
        throw new Error('手机号已被注册');
      }
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        email: email || null,
        phone: phone || null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      config.jwt.secret,
      { expiresIn: '7d' }
    );
    return {
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    };
  }

  /**
   * 用户登录
   */
  static async login(data: LoginRequest) {
    const { identifier, password } = data;

    // TODO: 验证图形验证码
    // const isCaptchaValid = CaptchaService.verifyCaptcha(captchaId, captchaCode);
    // if (!isCaptchaValid) {
    //   throw new Error('验证码错误或已过期');
    // }

    // 查找用户（支持用户名、邮箱、手机号登录）
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier },
          { phone: identifier },
        ],
        isActive: true,
      },
    });

    if (!user) {
      throw new Error('用户不存在或已被禁用');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('密码错误');
    }

    // 更新最后登录时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
      },
      token,
    };
  }

  /**
   * 验证JWT token
   */
  static async verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId: number;
        username: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId, isActive: true },
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          emailVerified: true,
          phoneVerified: true,
        },
      });

      if (!user) {
        throw new Error('用户不存在或已被禁用');
      }

      return user;
    } catch (error) {
      throw new Error('Token无效或已过期');
    }
  }
}
