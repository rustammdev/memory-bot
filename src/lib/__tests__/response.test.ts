import { describe, test, expect } from "bun:test";
import { ok, fail } from "../response";
import { AppError, ValidationError, NotFoundError } from "../errors";

describe("ok", () => {
  test("returns JSON response with ok: true envelope", async () => {
    const resp = ok({ id: 1, name: "test" });
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body).toEqual({ ok: true, data: { id: 1, name: "test" } });
  });

  test("uses custom status code", async () => {
    const resp = ok("created", 201);
    expect(resp.status).toBe(201);

    const body = await resp.json();
    expect(body).toEqual({ ok: true, data: "created" });
  });

  test("handles null data", async () => {
    const resp = ok(null);
    const body = await resp.json();
    expect(body).toEqual({ ok: true, data: null });
  });

  test("handles array data", async () => {
    const resp = ok([1, 2, 3]);
    const body = await resp.json();
    expect(body).toEqual({ ok: true, data: [1, 2, 3] });
  });
});

describe("fail", () => {
  test("handles AppError with correct status code", async () => {
    const err = new AppError("server error", 503);
    const resp = fail(err);
    expect(resp.status).toBe(503);

    const body = await resp.json();
    expect(body).toEqual({ ok: false, error: "server error" });
  });

  test("handles ValidationError (400)", async () => {
    const err = new ValidationError("bad input");
    const resp = fail(err);
    expect(resp.status).toBe(400);

    const body = await resp.json();
    expect(body).toEqual({ ok: false, error: "bad input" });
  });

  test("handles NotFoundError (404)", async () => {
    const err = new NotFoundError("not found");
    const resp = fail(err);
    expect(resp.status).toBe(404);

    const body = await resp.json();
    expect(body).toEqual({ ok: false, error: "not found" });
  });

  test("handles generic Error with 500 status", async () => {
    const err = new Error("unexpected crash");
    const resp = fail(err);
    expect(resp.status).toBe(500);

    const body = await resp.json();
    expect(body).toEqual({ ok: false, error: "unexpected crash" });
  });

  test("handles unknown error type with 500 status", async () => {
    const resp = fail("string error");
    expect(resp.status).toBe(500);

    const body = await resp.json();
    expect(body).toEqual({ ok: false, error: "Internal server error" });
  });

  test("handles null error with 500 status", async () => {
    const resp = fail(null);
    expect(resp.status).toBe(500);

    const body = await resp.json();
    expect(body).toEqual({ ok: false, error: "Internal server error" });
  });
});
