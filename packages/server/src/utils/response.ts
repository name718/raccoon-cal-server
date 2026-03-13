import type { Response } from 'express';

export class ApiResponse {
  /**
   * 成功响应
   */
  static success<T>(
    res: Response,
    data?: T,
    message = 'Success',
    statusCode = 200
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 错误响应
   */
  static error(
    res: Response,
    code: string,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>
  ) {
    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      timestamp: new Date().toISOString(),
    });
  }
}
