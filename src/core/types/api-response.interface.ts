export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  pagination?: PaginationMeta;
}

export interface ErrorResponse {
  code: string;
  details?: unknown;
}

export interface SuccessApiResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: ResponseMeta;
}

export interface ErrorApiResponse {
  success: false;
  message: string;
  error: ErrorResponse;
  meta?: ResponseMeta;
}

export type ApiResponse<T = unknown> = SuccessApiResponse<T> | ErrorApiResponse;
