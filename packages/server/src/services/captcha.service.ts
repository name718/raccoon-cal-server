import svgCaptcha from 'svg-captcha';
import { randomUUID } from 'crypto';

// 内存存储验证码，生产环境建议使用Redis
const captchaStore = new Map<string, { code: string; expires: number }>();

export class CaptchaService {
  /**
   * 生成图形验证码
   */
  static generateCaptcha() {
    // 生成验证码
    const captcha = svgCaptcha.create({
      size: 4, // 验证码长度
      ignoreChars: '0o1iIl', // 忽略容易混淆的字符
      noise: 2, // 干扰线条数
      color: true, // 彩色验证码
      background: '#f0f0f0', // 背景色
      width: 120,
      height: 40,
    });

    // 生成唯一ID
    const captchaId = randomUUID();

    // 存储验证码，5分钟过期
    const expires = Date.now() + 5 * 60 * 1000;
    captchaStore.set(captchaId, {
      code: captcha.text.toLowerCase(),
      expires,
    });

    // 清理过期的验证码
    this.cleanExpiredCaptchas();

    return {
      captchaId,
      captchaImage: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`,
    };
  }

  /**
   * 验证图形验证码
   */
  static verifyCaptcha(captchaId: string, userInput: string): boolean {
    const stored = captchaStore.get(captchaId);

    if (!stored) {
      return false; // 验证码不存在
    }

    if (Date.now() > stored.expires) {
      captchaStore.delete(captchaId);
      return false; // 验证码已过期
    }

    const isValid = stored.code === userInput.toLowerCase();

    // 验证后删除验证码（一次性使用）
    captchaStore.delete(captchaId);

    return isValid;
  }

  /**
   * 清理过期的验证码
   */
  private static cleanExpiredCaptchas() {
    const now = Date.now();
    for (const [id, data] of captchaStore.entries()) {
      if (now > data.expires) {
        captchaStore.delete(id);
      }
    }
  }

  /**
   * 获取当前存储的验证码数量（用于监控）
   */
  static getCaptchaCount(): number {
    return captchaStore.size;
  }
}
