import { describe, test, expect, mock } from "bun:test";

const mockDigestResponse = {
  channelName: "Test Channel",
  handle: "@testchannel",
  digest: {
    version: 1,
    summary: "Weekly digest",
    highlights: [],
    topicClusters: [],
    trendAnalysis: "Stable",
  },
};

mock.module("../../services/digest.service", () => ({
  getLatestDigest: () => Promise.resolve(mockDigestResponse),
  generateChannelDigest: () => Promise.resolve(mockDigestResponse),
  getDigestHistory: () =>
    Promise.resolve({ channelName: "Test Channel", digests: [] }),
}));

import { digestRoutes } from "../digest.routes";

describe("GET /api/digests", () => {
  const handler = digestRoutes["/api/digests"].GET;

  test("returns latest digest", async () => {
    const req = new Request(
      "http://localhost/api/digests?channel=testchannel",
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.data.channelName).toBe("Test Channel");
  });

  test("handles version parameter", async () => {
    const req = new Request(
      "http://localhost/api/digests?channel=testchannel&version=1",
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);
  });
});

describe("POST /api/digests", () => {
  const handler = digestRoutes["/api/digests"].POST;

  test("generates digest for valid body", async () => {
    const req = new Request("http://localhost/api/digests", {
      method: "POST",
      body: JSON.stringify({ channel: "testchannel" }),
      headers: { "Content-Type": "application/json" },
    });
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
  });

  test("returns error for invalid body", async () => {
    const req = new Request("http://localhost/api/digests", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const resp = await handler(req);
    expect(resp.status).toBe(400);
  });
});

describe("GET /api/digests/history", () => {
  const handler = digestRoutes["/api/digests/history"].GET;

  test("returns digest history", async () => {
    const req = new Request(
      "http://localhost/api/digests/history?channel=testchannel",
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.data.channelName).toBe("Test Channel");
  });
});
