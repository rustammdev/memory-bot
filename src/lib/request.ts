import { ValidationError } from "./errors";

export function queryParam(req: Request, key: string): string | null {
  return new URL(req.url).searchParams.get(key);
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
