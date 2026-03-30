import { describe, test, expect, mock } from "bun:test";

const mockTranscript = {
  videoId: "abc123",
  language: "en",
  content: "Transcript content here...",
  summary: "A test video about coding.",
  vectorized: true,
  createdAt: new Date().toISOString(),
};

mock.module("../../services/transcript.service", () => ({
  getTranscript: (videoId: string | null) => {
    if (!videoId) return Promise.reject(Object.assign(new Error('"videoId" is required'), { statusCode: 400 }));
    return Promise.resolve({ transcript: mockTranscript });
  },
  fetchAndSaveTranscript: (videoId: string | null) => {
    if (!videoId) return Promise.reject(Object.assign(new Error('"videoId" is required'), { statusCode: 400 }));
    return Promise.resolve(mockTranscript);
  },
}));

import { transcriptRoutes } from "../transcript.routes";

describe("GET /api/transcripts", () => {
  const handler = transcriptRoutes["/api/transcripts"].GET;

  test("returns transcript for valid videoId", async () => {
    const req = new Request(
      "http://localhost/api/transcripts?videoId=abc123",
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.data.transcript.videoId).toBe("abc123");
  });

  test("returns error for missing videoId", async () => {
    const req = new Request("http://localhost/api/transcripts");
    const resp = await handler(req);

    const body = await resp.json();
    expect(body.ok).toBe(false);
  });
});

describe("POST /api/transcripts", () => {
  const handler = transcriptRoutes["/api/transcripts"].POST;

  test("fetches and saves transcript", async () => {
    const req = new Request(
      "http://localhost/api/transcripts?videoId=abc123",
      { method: "POST" },
    );
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
  });

  test("returns error for missing videoId", async () => {
    const req = new Request("http://localhost/api/transcripts", {
      method: "POST",
    });
    const resp = await handler(req);

    const body = await resp.json();
    expect(body.ok).toBe(false);
  });
});
