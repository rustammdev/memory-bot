export function deduplicateByKey<T>(
  items: ReadonlyArray<T>,
  keyFn: (item: T) => string,
): ReadonlyArray<T> {
  const seen = new Map<string, T>();
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
}
