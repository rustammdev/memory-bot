import { AppError } from "./errors";

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
    const body: ErrorEnvelope = { ok: false, error: err.message };
    return Response.json(body, { status: err.statusCode });
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  const body: ErrorEnvelope = { ok: false, error: message };
  return Response.json(body, { status: 500 });
}
