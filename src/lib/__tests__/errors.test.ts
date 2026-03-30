import { describe, test, expect } from "bun:test";
import {
  AppError,
  ValidationError,
  NotFoundError,
  ExternalServiceError,
} from "../errors";

describe("AppError", () => {
  test("creates error with message and statusCode", () => {
    const err = new AppError("something broke", 503);
    expect(err.message).toBe("something broke");
    expect(err.statusCode).toBe(503);
  });

  test("is an instance of Error", () => {
    const err = new AppError("test", 500);
    expect(err).toBeInstanceOf(Error);
  });

  test("preserves statusCode as readonly", () => {
    const err = new AppError("test", 418);
    expect(err.statusCode).toBe(418);
  });
});

describe("ValidationError", () => {
  test("has 400 status code", () => {
    const err = new ValidationError("invalid input");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("invalid input");
  });

  test("is an instance of AppError", () => {
    const err = new ValidationError("bad");
    expect(err).toBeInstanceOf(AppError);
  });

  test("is an instance of Error", () => {
    const err = new ValidationError("bad");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("NotFoundError", () => {
  test("has 404 status code", () => {
    const err = new NotFoundError("channel not found");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("channel not found");
  });

  test("is an instance of AppError", () => {
    const err = new NotFoundError("gone");
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("ExternalServiceError", () => {
  test("has 502 status code and formatted message", () => {
    const err = new ExternalServiceError("YouTube", "rate limit exceeded");
    expect(err.statusCode).toBe(502);
    expect(err.message).toBe("YouTube error: rate limit exceeded");
  });

  test("is an instance of AppError", () => {
    const err = new ExternalServiceError("OpenAI", "timeout");
    expect(err).toBeInstanceOf(AppError);
  });
});
