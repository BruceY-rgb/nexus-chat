// =====================================================
// API 响应格式
// =====================================================

/**
 * 成功响应
 */
export function successResponse<T>(data: T, message?: string) {
  return {
    success: true,
    message: message || '操作成功',
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 错误响应
 */
export function errorResponse(
  message: string,
  code?: string,
  details?: Record<string, any>
) {
  return {
    success: false,
    message,
    code: code || 'ERROR',
    details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 分页响应
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }
) {
  return {
    success: true,
    data,
    pagination,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 未授权响应
 */
export function unauthorizedResponse(message = '未授权访问') {
  return errorResponse(message, 'UNAUTHORIZED');
}

/**
 * 禁止访问响应
 */
export function forbiddenResponse(message = '禁止访问') {
  return errorResponse(message, 'FORBIDDEN');
}

/**
 * 未找到响应
 */
export function notFoundResponse(message = '资源未找到') {
  return errorResponse(message, 'NOT_FOUND');
}

/**
 * 验证错误响应
 */
export function validationErrorResponse(errors: Record<string, string>) {
  return errorResponse('输入数据验证失败', 'VALIDATION_ERROR', { errors });
}