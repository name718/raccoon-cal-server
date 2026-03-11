import { Response } from 'express';
import { ApiResponse } from '@/types';

export class ResponseUtil {
  static success<T>(res: Response, data?: T, statusCode = 200): Response {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    message: string,
    code = 'UNKNOWN_ERROR',
    statusCode = 500
  ): Response {
    const response: ApiResponse = {
      success: false,
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
  }

  static badRequest(res: Response, message: string): Response {
    return this.error(res, message, 'BAD_REQUEST', 400);
  }

  static unauthorized(res: Response, message = 'Unauthorized'): Response {
    return this.error(res, message, 'UNAUTHORIZED', 401);
  }

  static forbidden(res: Response, message = 'Forbidden'): Response {
    return this.error(res, message, 'FORBIDDEN', 403);
  }

  static notFound(res: Response, message = 'Not found'): Response {
    return this.error(res, message, 'NOT_FOUND', 404);
  }

  static conflict(res: Response, message: string): Response {
    return this.error(res, message, 'CONFLICT', 409);
  }

  static validationError(res: Response, message: string): Response {
    return this.error(res, message, 'VALIDATION_ERROR', 422);
  }
}
