import { describe, test, expect, mock } from "bun:test";

const mockChatResult = {
  channelName: "Test Channel",
  handle: "@testchannel",
  reply: "Hello from the agent!",
};

const mockMultiResult = {
  channels: [
    { name: "Channel A", handle: "@channelA" },
    { name: "Channel B", handle: "@channelB" },
  ],
  reply: "Comparison result",
};

mock.module("../../services/chat.service", () => ({
  chat: () => Promise.resolve(mockChatResult),
  multiChat: () => Promise.resolve(mockMultiResult),
}));

mock.module("../../memory/client", () => ({
  getUserMemories: () => Promise.resolve([{ text: "remembered fact" }]),
}));

mock.module("../../services/channel.helpers", () => ({
  requireChannel: () =>
    Promise.resolve({
      id: "ch-1",
      username: "@testchannel",
      name: "Test Channel",
    }),
}));

import { chatRoutes } from "../chat.routes";

describe("POST /api/chat", () => {
  const handler = chatRoutes["/api/chat"].POST;

  test("returns ok response for valid request", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        channel: "testchannel",
        message: "Hello",
        userId: "user-1",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.data.reply).toBe("Hello from the agent!");
  });

  test("returns error for invalid body", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const resp = await handler(req);
    expect(resp.status).toBe(400);

    const body = await resp.json();
    expect(body.ok).toBe(false);
  });
});

describe("POST /api/chat/multi", () => {
  const handler = chatRoutes["/api/chat/multi"].POST;

  test("returns ok response for valid request", async () => {
    const req = new Request("http://localhost/api/chat/multi", {
      method: "POST",
      body: JSON.stringify({
        channels: ["channel1", "channel2"],
        message: "Compare",
        userId: "user-1",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.data.channels.length).toBe(2);
  });
});

describe("GET /api/chat/memories", () => {
  const handler = chatRoutes["/api/chat/memories"].GET;

  test("returns memories for valid params", async () => {
    const req = new Request(
      "http://localhost/api/chat/memories?channel=testchannel&userId=user-1",
    );

    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.data.memories).toBeDefined();
  });

  test("returns error for missing channel", async () => {
    const req = new Request("http://localhost/api/chat/memories?userId=user-1");

    const resp = await handler(req);
    expect(resp.status).toBe(400);
  });

  test("returns error for missing userId", async () => {
    const req = new Request(
      "http://localhost/api/chat/memories?channel=testchannel",
    );

    const resp = await handler(req);
    expect(resp.status).toBe(400);
  });
});
