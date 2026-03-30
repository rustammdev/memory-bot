import { describe, test, expect, mock } from "bun:test";

const mockChannelVideos = {
  channelName: "Test Channel",
  channelId: "UC123",
  handle: "@testchannel",
  totalVideos: 100,
  metadata: null,
  videos: [
    { id: "abc123", title: "Test Video", viewCount: 5000, hasTranscript: false },
  ],
};

const mockMetadata = {
  version: 1,
  overview: "A tech channel",
  category: "technology",
  language: "en",
};

mock.module("../../services/channel.service", () => ({
  getChannelVideos: () => Promise.resolve(mockChannelVideos),
  getChannelMetadata: () => Promise.resolve(mockMetadata),
  getChannelMetadataVersions: () =>
    Promise.resolve([{ version: 1 }, { version: 2 }]),
  generateMetadata: () => Promise.resolve(mockMetadata),
}));

import { channelRoutes } from "../channel.routes";

describe("GET /api/channels/videos", () => {
  const handler = channelRoutes["/api/channels/videos"].GET;

  test("returns channel videos", async () => {
    const req = new Request(
      "http://localhost/api/channels/videos?channel=testchannel",
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.data.channelName).toBe("Test Channel");
    expect(body.data.videos.length).toBe(1);
  });

  test("handles transcribed filter", async () => {
    const req = new Request(
      "http://localhost/api/channels/videos?channel=testchannel&transcribed=true",
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);
  });
});

describe("GET /api/channels/metadata", () => {
  const handler = channelRoutes["/api/channels/metadata"].GET;

  test("returns channel metadata", async () => {
    const req = new Request(
      "http://localhost/api/channels/metadata?channel=testchannel",
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.data.category).toBe("technology");
  });

  test("handles version parameter", async () => {
    const req = new Request(
      "http://localhost/api/channels/metadata?channel=testchannel&version=2",
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);
  });
});

describe("POST /api/channels/metadata", () => {
  const handler = channelRoutes["/api/channels/metadata"].POST;

  test("generates metadata", async () => {
    const req = new Request(
      "http://localhost/api/channels/metadata?channel=testchannel",
      { method: "POST" },
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);
  });
});

describe("GET /api/channels/metadata/versions", () => {
  const handler = channelRoutes["/api/channels/metadata/versions"].GET;

  test("returns metadata versions", async () => {
    const req = new Request(
      "http://localhost/api/channels/metadata/versions?channel=testchannel",
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
  });
});
