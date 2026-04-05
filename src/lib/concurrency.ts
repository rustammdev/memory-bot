import { createLogger } from "./logger";

const bgLog = createLogger("background");

interface BackgroundOptions {
  readonly label: string;
  readonly retries?: number;
  readonly delayMs?: number;
}

export function runInBackground(
  fn: () => Promise<void>,
  opts: BackgroundOptions,
): void {
  const { label, retries = 3, delayMs = 500 } = opts;

  const attempt = (n: number): Promise<void> =>
    fn().catch(async (err) => {
      if (n >= retries) {
        bgLog.error(`${label} failed permanently`, { attempts: n, err: String(err) });
        return;
      }
      const wait = delayMs * Math.pow(2, n - 1);
      bgLog.warn(`${label} failed, retrying (${n}/${retries}) in ${wait}ms`, { err: String(err) });
      await new Promise((r) => setTimeout(r, wait));
      return attempt(n + 1);
    });

  attempt(1).catch(() => {});
}

export async function processWithConcurrency<T>(
  items: ReadonlyArray<T>,
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const p = fn(item).then(() => { executing.delete(p); });
    executing.add(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}
