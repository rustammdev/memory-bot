import { describe, test, expect, mock } from "bun:test";

const mockGapResponse = {
  channelName: "Test Channel",
  handle: "@testchannel",
  category: "technology",
  totalVideosAnalyzed: 25,
  gaps: [],
  summary: "Good coverage",
};

mock.module("../../services/content-gap.service", () => ({
  getLatestAnalysis: () => Promise.resolve(mockGapResponse),
  analyzeChannelGaps: () => Promise.resolve(mockGapResponse),
  getAnalysisVersions: () =>
    Promise.resolve({ channelName: "Test Channel", versions: [] }),
}));

import { contentGapRoutes } from "../content-gap.routes";

describe("GET /api/channels/content-gaps", () => {
  const handler = contentGapRoutes["/api/channels/content-gaps"].GET;

  test("returns latest analysis", async () => {
    const req = new Request(
      "http://localhost/api/channels/content-gaps?channel=testchannel",
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.data.channelName).toBe("Test Channel");
  });
});

describe("POST /api/channels/content-gaps", () => {
  const handler = contentGapRoutes["/api/channels/content-gaps"].POST;

  test("triggers gap analysis", async () => {
    const req = new Request(
      "http://localhost/api/channels/content-gaps?channel=testchannel",
      { method: "POST" },
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
  });

  test("supports force parameter", async () => {
    const req = new Request(
      "http://localhost/api/channels/content-gaps?channel=testchannel&force=true",
      { method: "POST" },
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);
  });
});

describe("GET /api/channels/content-gaps/versions", () => {
  const handler = contentGapRoutes["/api/channels/content-gaps/versions"].GET;

  test("returns version history", async () => {
    const req = new Request(
      "http://localhost/api/channels/content-gaps/versions?channel=testchannel",
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.data.versions).toBeDefined();
  });
});
