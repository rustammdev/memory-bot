import { describe, test, expect } from "bun:test";
import {
  isValidChatMessage,
  chatRequestSchema,
  multiChatRequestSchema,
} from "../chat";

describe("isValidChatMessage", () => {
  test("accepts valid user message", () => {
    expect(isValidChatMessage({ role: "user", content: "hello" })).toBe(true);
  });

  test("accepts valid assistant message", () => {
    expect(
      isValidChatMessage({ role: "assistant", content: "hi there" }),
    ).toBe(true);
  });

  test("rejects invalid role", () => {
    expect(isValidChatMessage({ role: "system", content: "test" })).toBe(false);
  });

  test("rejects missing content", () => {
    expect(isValidChatMessage({ role: "user" })).toBe(false);
  });

  test("rejects missing role", () => {
    expect(isValidChatMessage({ content: "hello" })).toBe(false);
  });

  test("rejects null", () => {
    expect(isValidChatMessage(null)).toBe(false);
  });

  test("rejects undefined", () => {
    expect(isValidChatMessage(undefined)).toBe(false);
  });

  test("rejects number", () => {
    expect(isValidChatMessage(42)).toBe(false);
  });

  test("rejects string", () => {
    expect(isValidChatMessage("hello")).toBe(false);
  });

  test("rejects empty object", () => {
    expect(isValidChatMessage({})).toBe(false);
  });

  test("rejects non-string content", () => {
    expect(isValidChatMessage({ role: "user", content: 123 })).toBe(false);
  });
});

describe("chatRequestSchema", () => {
  test("accepts valid request", () => {
    const result = chatRequestSchema.safeParse({
      channel: "CalebWritesCode",
      message: "hello",
      userId: "user-1",
    });
    expect(result.success).toBe(true);
  });

  test("accepts request with history", () => {
    const result = chatRequestSchema.safeParse({
      channel: "CalebWritesCode",
      message: "hello",
      userId: "user-1",
      history: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello!" },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty channel", () => {
    const result = chatRequestSchema.safeParse({
      channel: "",
      message: "hello",
      userId: "user-1",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty message", () => {
    const result = chatRequestSchema.safeParse({
      channel: "test",
      message: "",
      userId: "user-1",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing userId", () => {
    const result = chatRequestSchema.safeParse({
      channel: "test",
      message: "hello",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid history entry", () => {
    const result = chatRequestSchema.safeParse({
      channel: "test",
      message: "hello",
      userId: "user-1",
      history: [{ role: "system", content: "bad" }],
    });
    expect(result.success).toBe(false);
  });

  test("allows missing history (optional)", () => {
    const result = chatRequestSchema.safeParse({
      channel: "test",
      message: "hello",
      userId: "user-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.history).toBeUndefined();
    }
  });
});

describe("multiChatRequestSchema", () => {
  test("accepts valid multi-channel request", () => {
    const result = multiChatRequestSchema.safeParse({
      channels: ["channel1", "channel2"],
      message: "compare these",
      userId: "user-1",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty channels array", () => {
    const result = multiChatRequestSchema.safeParse({
      channels: [],
      message: "hello",
      userId: "user-1",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing channels", () => {
    const result = multiChatRequestSchema.safeParse({
      message: "hello",
      userId: "user-1",
    });
    expect(result.success).toBe(false);
  });

  test("accepts request with history", () => {
    const result = multiChatRequestSchema.safeParse({
      channels: ["ch1"],
      message: "test",
      userId: "user-1",
      history: [{ role: "user", content: "prev" }],
    });
    expect(result.success).toBe(true);
  });
});
