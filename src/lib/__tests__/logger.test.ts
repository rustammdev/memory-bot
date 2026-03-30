import { describe, test, expect } from "bun:test";
import { createLogger } from "../logger";

describe("createLogger", () => {
  test("creates scoped logger with all methods", () => {
    const log = createLogger("test");
    expect(typeof log.debug).toBe("function");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.time).toBe("function");
  });

  test("log methods do not throw", () => {
    const log = createLogger("test");
    expect(() => log.debug("test message")).not.toThrow();
    expect(() => log.info("test message")).not.toThrow();
    expect(() => log.warn("test message")).not.toThrow();
    expect(() => log.error("test message")).not.toThrow();
  });

  test("log methods accept extra object", () => {
    const log = createLogger("test");
    expect(() => log.info("test", { key: "value" })).not.toThrow();
    expect(() => log.error("error", { code: 500 })).not.toThrow();
  });

  test("time returns a function", () => {
    const log = createLogger("test");
    const done = log.time("operation");
    expect(typeof done).toBe("function");
  });

  test("time done function does not throw", () => {
    const log = createLogger("test");
    const done = log.time("operation");
    expect(() => done()).not.toThrow();
    expect(() => done({ extra: "data" })).not.toThrow();
  });
});
