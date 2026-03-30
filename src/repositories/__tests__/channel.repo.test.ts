import { describe, test, expect, beforeEach } from "bun:test";
import { pushMockRows, clearMockRows } from "../../__test-utils__/db-mock";
import {
  findByUsername,
  findByYoutubeId,
  upsert,
  findByUsernames,
  search,
  type ChannelRow,
} from "../channel.repo";

const sampleChannel: ChannelRow = {
  id: "ch-1",
  youtube_id: "UC123",
  username: "testchannel",
  name: "Test Channel",
  followers: 1000,
  video_count: 50,
  avatar_url: "https://img.youtube.com/avatar.jpg",
  banner_url: null,
  last_synced_at: new Date("2025-01-01"),
  created_at: new Date("2025-01-01"),
  updated_at: new Date("2025-01-01"),
};

beforeEach(() => {
  clearMockRows();
});

describe("findByUsername", () => {
  test("returns channel when found", async () => {
    pushMockRows([sampleChannel]);
    const result = await findByUsername("testchannel");
    expect(result).toEqual(sampleChannel);
  });

  test("returns null when not found", async () => {
    pushMockRows([]);
    const result = await findByUsername("nonexistent");
    expect(result).toBeNull();
  });
});

describe("findByYoutubeId", () => {
  test("returns channel when found", async () => {
    pushMockRows([sampleChannel]);
    const result = await findByYoutubeId("UC123");
    expect(result).toEqual(sampleChannel);
  });

  test("returns null when not found", async () => {
    pushMockRows([]);
    const result = await findByYoutubeId("UC_NONE");
    expect(result).toBeNull();
  });
});

describe("upsert", () => {
  test("returns upserted channel", async () => {
    pushMockRows([sampleChannel]);
    const result = await upsert({
      youtubeId: "UC123",
      username: "testchannel",
      name: "Test Channel",
      followers: 1000,
      videoCount: 50,
    });
    expect(result).toEqual(sampleChannel);
  });

  test("handles optional fields", async () => {
    pushMockRows([sampleChannel]);
    const result = await upsert({
      youtubeId: "UC123",
      username: "testchannel",
      name: "Test Channel",
    });
    expect(result.id).toBe("ch-1");
  });
});

describe("findByUsernames", () => {
  test("returns empty array for empty input", async () => {
    const result = await findByUsernames([]);
    expect(result).toEqual([]);
  });

  test("returns channels for valid usernames", async () => {
    pushMockRows([sampleChannel]);
    const result = await findByUsernames(["testchannel"]);
    expect(result.length).toBe(1);
  });
});

describe("search", () => {
  test("returns matching channels", async () => {
    pushMockRows([sampleChannel]);
    const result = await search("test");
    expect(result.length).toBe(1);
  });

  test("returns empty for no matches", async () => {
    pushMockRows([]);
    const result = await search("zzz");
    expect(result).toEqual([]);
  });
});
