import { AppError, ExternalServiceError } from "./errors";
import { createLogger } from "./logger";

const log = createLogger("response");

interface SuccessEnvelope<T> {
  readonly ok: true;
  readonly data: T;
}

interface ErrorEnvelope {
  readonly ok: false;
  readonly error: string;
}

export function ok<T>(data: T, status = 200): Response {
  const body: SuccessEnvelope<T> = { ok: true, data };
  return Response.json(body, { status });
}

export function fail(err: unknown): Response {
  if (err instanceof AppError) {
    if (err instanceof ExternalServiceError) {
      log.error(`${err.service} error`, { detail: err.detail });
    }
    const body: ErrorEnvelope = { ok: false, error: err.message };
    return Response.json(body, { status: err.statusCode });
  }

  const detail = err instanceof Error ? err.message : String(err);
  log.error("Unhandled error", { detail });
  const body: ErrorEnvelope = { ok: false, error: "Internal server error" };
  return Response.json(body, { status: 500 });
}
