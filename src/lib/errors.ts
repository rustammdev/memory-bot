export class AppError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class ExternalServiceError extends AppError {
  readonly service: string;
  readonly detail: string;

  constructor(service: string, detail: string) {
    super(`${service} service is temporarily unavailable`, 502);
    this.service = service;
    this.detail = detail;
  }
}
