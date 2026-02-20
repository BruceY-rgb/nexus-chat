// =====================================================
// API Response Format
// =====================================================

/**
 * Success response
 */
export function successResponse<T>(data: T, message?: string) {
  return {
    success: true,
    message: message || 'Operation successful',
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Error response
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
 * Paginated response
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
 * Unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized access') {
  return errorResponse(message, 'UNAUTHORIZED');
}

/**
 * Forbidden response
 */
export function forbiddenResponse(message = 'Forbidden') {
  return errorResponse(message, 'FORBIDDEN');
}

/**
 * Not found response
 */
export function notFoundResponse(message = 'Resource not found') {
  return errorResponse(message, 'NOT_FOUND');
}

/**
 * Validation error response
 */
export function validationErrorResponse(errors: Record<string, string>) {
  return errorResponse('Input data validation failed', 'VALIDATION_ERROR', { errors });
}
