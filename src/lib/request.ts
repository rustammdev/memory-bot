import { z } from "zod";
import { ValidationError } from "./errors";

export function queryParam(req: Request, key: string): string | null {
  return new URL(req.url).searchParams.get(key);
}

export function requireParam(value: string | null, name: string): string {
  if (!value || value.trim().length === 0) {
    throw new ValidationError(`"${name}" query parameter is required`);
  }
  return value.trim();
}

export function queryParamInt(req: Request, key: string): number | undefined {
  const raw = queryParam(req, key);
  if (raw === null) return undefined;
  const num = Number(raw);
  if (Number.isNaN(num) || !Number.isInteger(num)) {
    throw new ValidationError(`"${key}" must be an integer`);
  }
  return num;
}

export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const raw = await req.json();
  const result = schema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new ValidationError(messages);
  }
  return result.data;
}
