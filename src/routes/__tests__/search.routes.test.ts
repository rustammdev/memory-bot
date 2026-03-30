import { describe, test, expect, mock } from "bun:test";

const mockResults = [
  {
    content: "TypeScript basics",
    videoTitle: "TS Tutorial",
    videoUrl: "https://youtube.com/watch?v=123",
    similarity: 0.9,
  },
];

mock.module("../../services/search.service", () => ({
  searchChannelContent: (_ch: string, _q: string) => {
    if (!_ch || !_q) throw Object.assign(new Error("required"), { statusCode: 400 });
    return Promise.resolve(mockResults);
  },
}));

import { searchRoutes } from "../search.routes";

describe("GET /api/search", () => {
  const handler = searchRoutes["/api/search"].GET;

  test("returns search results", async () => {
    const req = new Request(
      "http://localhost/api/search?channel=testchannel&q=TypeScript",
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.data.length).toBe(1);
  });

  test("returns error for missing query", async () => {
    const req = new Request(
      "http://localhost/api/search?channel=testchannel",
    );
    const resp = await handler(req);
    const body = await resp.json();
    expect(body.ok).toBe(false);
  });
});
