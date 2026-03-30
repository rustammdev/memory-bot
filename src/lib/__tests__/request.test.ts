import { describe, test, expect } from "bun:test";
import { z } from "zod";
import { queryParam, requireParam, queryParamInt, parseBody } from "../request";
import { ValidationError } from "../errors";

function makeRequest(url: string): Request {
  return new Request(url);
}

describe("queryParam", () => {
  test("returns value when param exists", () => {
    const req = makeRequest("http://localhost/api?channel=test");
    expect(queryParam(req, "channel")).toBe("test");
  });

  test("returns null when param is missing", () => {
    const req = makeRequest("http://localhost/api");
    expect(queryParam(req, "channel")).toBeNull();
  });

  test("returns empty string when param has no value", () => {
    const req = makeRequest("http://localhost/api?channel=");
    expect(queryParam(req, "channel")).toBe("");
  });

  test("handles multiple params", () => {
    const req = makeRequest("http://localhost/api?a=1&b=2&c=3");
    expect(queryParam(req, "b")).toBe("2");
  });

  test("handles encoded values", () => {
    const req = makeRequest("http://localhost/api?q=hello%20world");
    expect(queryParam(req, "q")).toBe("hello world");
  });
});

describe("requireParam", () => {
  test("returns trimmed value when valid", () => {
    expect(requireParam("  hello  ", "name")).toBe("hello");
  });

  test("throws ValidationError for null", () => {
    expect(() => requireParam(null, "channel")).toThrow(ValidationError);
  });

  test("throws ValidationError for empty string", () => {
    expect(() => requireParam("", "channel")).toThrow(ValidationError);
  });

  test("throws ValidationError for whitespace-only string", () => {
    expect(() => requireParam("   ", "channel")).toThrow(ValidationError);
  });

  test("error message includes parameter name", () => {
    try {
      requireParam(null, "videoId");
    } catch (e) {
      expect((e as ValidationError).message).toContain("videoId");
    }
  });
});

describe("queryParamInt", () => {
  test("returns number for valid integer", () => {
    const req = makeRequest("http://localhost/api?limit=10");
    expect(queryParamInt(req, "limit")).toBe(10);
  });

  test("returns undefined when param is missing", () => {
    const req = makeRequest("http://localhost/api");
    expect(queryParamInt(req, "limit")).toBeUndefined();
  });

  test("throws ValidationError for non-numeric value", () => {
    const req = makeRequest("http://localhost/api?limit=abc");
    expect(() => queryParamInt(req, "limit")).toThrow(ValidationError);
  });

  test("throws ValidationError for float value", () => {
    const req = makeRequest("http://localhost/api?limit=3.14");
    expect(() => queryParamInt(req, "limit")).toThrow(ValidationError);
  });

  test("handles zero", () => {
    const req = makeRequest("http://localhost/api?page=0");
    expect(queryParamInt(req, "page")).toBe(0);
  });

  test("handles negative integers", () => {
    const req = makeRequest("http://localhost/api?offset=-5");
    expect(queryParamInt(req, "offset")).toBe(-5);
  });
});

describe("parseBody", () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  test("parses valid body", async () => {
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ name: "Alice", age: 30 }),
      headers: { "Content-Type": "application/json" },
    });

    const result = await parseBody(req, schema);
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  test("throws ValidationError for invalid body", async () => {
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ name: "", age: -1 }),
      headers: { "Content-Type": "application/json" },
    });

    try {
      await parseBody(req, schema);
      expect(true).toBe(false); // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });

  test("throws ValidationError for missing fields", async () => {
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    try {
      await parseBody(req, schema);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });

  test("error message includes field paths", async () => {
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ name: 123, age: "not a number" }),
      headers: { "Content-Type": "application/json" },
    });

    try {
      await parseBody(req, schema);
      expect(true).toBe(false);
    } catch (e) {
      const msg = (e as ValidationError).message;
      expect(msg).toContain("name");
      expect(msg).toContain("age");
    }
  });
});
