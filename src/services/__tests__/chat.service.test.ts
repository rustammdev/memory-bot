import { describe, test, expect, mock } from "bun:test";

// Mock all external dependencies
const mockChannelRow = {
  id: "ch-1",
  youtube_id: "UC123",
  username: "@testchannel",
  name: "Test Channel",
  followers: 5000,
  video_count: 100,
  avatar_url: null,
  banner_url: null,
  last_synced_at: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
};

mock.module("../channel.helpers", () => ({
  requireChannel: () => Promise.resolve(mockChannelRow),
  requireChannelParam: (input: string) => input,
  resolveChannel: () => Promise.resolve(mockChannelRow),
  toApiResponse: () => ({}),
}));

mock.module("../../agent/channel/create", () => ({
  getChannelAgent: () =>
    Promise.resolve({
      invoke: () =>
        Promise.resolve({
          messages: [{ content: "Agent reply" }],
        }),
    }),
}));

mock.module("../../agent/multi/create", () => ({
  getMultiChannelAgent: () =>
    Promise.resolve({
      invoke: () =>
        Promise.resolve({
          messages: [{ content: "Multi-agent reply" }],
        }),
    }),
}));

mock.module("../../memory/client", () => ({
  recallMemories: () => Promise.resolve(""),
  saveConversation: () => Promise.resolve(),
}));

mock.module("../../repositories/channel.repo", () => ({
  findByUsernames: (usernames: string[]) => {
    if (usernames.includes("missing")) return Promise.resolve([]);
    return Promise.resolve(
      usernames.map((u: string, i: number) => ({
        ...mockChannelRow,
        id: `ch-${i}`,
        username: u,
        name: `Channel ${i}`,
      })),
    );
  },
}));

mock.module("../../lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    time: () => () => {},
  }),
}));

import { chat, multiChat } from "../chat.service";
import { ValidationError } from "../../lib/errors";

describe("chat", () => {
  test("returns response with channel info and reply", async () => {
    const result = await chat({
      channel: "testchannel",
      message: "Hello",
      userId: "user-1",
    });

    expect(result.channelName).toBe("Test Channel");
    expect(result.handle).toBe("@testchannel");
    expect(typeof result.reply).toBe("string");
  });

  test("includes reply from agent", async () => {
    const result = await chat({
      channel: "testchannel",
      message: "Tell me about videos",
      userId: "user-1",
    });

    expect(result.reply).toBe("Agent reply");
  });

  test("handles message history", async () => {
    const result = await chat({
      channel: "testchannel",
      message: "Follow up",
      userId: "user-1",
      history: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ],
    });

    expect(result.reply).toBeDefined();
  });
});

describe("multiChat", () => {
  test("returns response with multiple channels", async () => {
    const result = await multiChat({
      channels: ["channel1", "channel2"],
      message: "Compare these",
      userId: "user-1",
    });

    expect(result.channels.length).toBe(2);
    expect(typeof result.reply).toBe("string");
  });

  test("throws for less than 2 channels", async () => {
    try {
      await multiChat({
        channels: ["channel1"],
        message: "test",
        userId: "user-1",
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });

  test("throws for more than 10 channels", async () => {
    const channels = Array.from({ length: 11 }, (_, i) => `ch${i}`);
    try {
      await multiChat({
        channels,
        message: "test",
        userId: "user-1",
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });

  test("throws when no channels found", async () => {
    try {
      await multiChat({
        channels: ["missing", "missing2"],
        message: "test",
        userId: "user-1",
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });
});
