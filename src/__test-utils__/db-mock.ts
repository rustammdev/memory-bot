/**
 * Global DB mock queue. Test files push expected results here
 * and the mock db function shifts them off as queries execute.
 */
const globalQueue: any[][] = [];

export function pushMockRows(...batches: any[][]): void {
  globalQueue.push(...batches);
}

export function clearMockRows(): void {
  globalQueue.length = 0;
}

function shift(): any[] {
  return globalQueue.shift() ?? [];
}

function createTaggedTemplate() {
  return (_strings: TemplateStringsArray, ..._values: any[]) =>
    Promise.resolve(shift());
}

export function createMockDb() {
  const fn = createTaggedTemplate();
  (fn as any).begin = async (callback: Function) => {
    const tx = createTaggedTemplate();
    return callback(tx);
  };
  (fn as any).close = () => Promise.resolve();
  return fn;
}

export const mockDb = createMockDb();
