export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code = statusCode,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const invalid = (message: string): ApiError => new ApiError(message, 422);
export const notFound = (message: string): ApiError => new ApiError(message, 404);
export const conflict = (message: string): ApiError => new ApiError(message, 409);
