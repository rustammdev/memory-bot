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

export function toBatches<T>(
  items: ReadonlyArray<T>,
  size: number,
): ReadonlyArray<ReadonlyArray<T>> {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
