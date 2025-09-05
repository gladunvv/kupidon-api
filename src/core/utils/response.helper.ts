import {
  ApiResponse,
  SuccessResponse,
  ErrorApiResponse,
  PaginationMeta,
} from '../types/api-response.interface';

export class ResponseHelper {
  /**
   * Создает успешный ответ
   */
  static success<T>(
    data: T,
    message: string = 'Operation completed successfully',
  ): SuccessResponse<T> {
    return {
      success: true,
      message,
      data,
    };
  }

  /**
   * Создает успешный ответ с пагинацией
   */
  static successWithPagination<T>(
    data: T[],
    pagination: PaginationMeta,
    message: string = 'Data retrieved successfully',
  ): SuccessResponse<T[]> {
    return {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        pagination,
      },
    };
  }

  /**
   * Создает ответ с ошибкой
   */
  static error(message: string, code: string, details?: any): ErrorApiResponse {
    return {
      success: false,
      message,
      error: {
        code,
        details,
      },
    };
  }

  /**
   * Создает ответ только с сообщением (без данных)
   */
  static message(message: string): ApiResponse {
    return {
      success: true,
      message,
    };
  }
}

// Константы для кодов ошибок
export const ERROR_CODES = {
  // Авторизация
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // OTP
  INVALID_OTP: 'INVALID_OTP',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_ALREADY_USED: 'OTP_ALREADY_USED',
  TOO_MANY_OTP_REQUESTS: 'TOO_MANY_OTP_REQUESTS',

  // Пользователи
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',

  // Валидация
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PHONE_FORMAT: 'INVALID_PHONE_FORMAT',

  // Общие
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
} as const;
