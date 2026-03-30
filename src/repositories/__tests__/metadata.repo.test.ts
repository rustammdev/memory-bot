import { describe, test, expect, beforeEach } from "bun:test";
import { pushMockRows, clearMockRows } from "../../__test-utils__/db-mock";
import {
  findLatest,
  findByVersion,
  findAll,
  create,
  type MetadataRow,
} from "../metadata.repo";

const sampleMetadata: MetadataRow = {
  id: "m-1",
  channel_id: "ch-1",
  version: 1,
  overview: "A technology channel about TypeScript.",
  associated_video_types: "tutorials, reviews",
  category: "technology",
  language: "en",
  created_at: new Date("2025-01-01"),
};

beforeEach(() => {
  clearMockRows();
});

describe("findLatest", () => {
  test("returns latest metadata", async () => {
    pushMockRows([sampleMetadata]);
    const result = await findLatest("ch-1");
    expect(result).toEqual(sampleMetadata);
  });

  test("returns null when none exists", async () => {
    pushMockRows([]);
    const result = await findLatest("ch-none");
    expect(result).toBeNull();
  });
});

describe("findByVersion", () => {
  test("returns metadata for specific version", async () => {
    pushMockRows([sampleMetadata]);
    const result = await findByVersion("ch-1", 1);
    expect(result).toEqual(sampleMetadata);
  });

  test("returns null for non-existent version", async () => {
    pushMockRows([]);
    const result = await findByVersion("ch-1", 99);
    expect(result).toBeNull();
  });
});

describe("findAll", () => {
  test("returns all versions", async () => {
    pushMockRows([sampleMetadata, { ...sampleMetadata, version: 2 }]);
    const result = await findAll("ch-1");
    expect(result.length).toBe(2);
  });

  test("returns empty for no metadata", async () => {
    pushMockRows([]);
    const result = await findAll("ch-none");
    expect(result).toEqual([]);
  });
});

describe("create", () => {
  test("creates metadata with auto-version", async () => {
    pushMockRows([{ next_version: 2 }], [{ ...sampleMetadata, version: 2 }]);
    const result = await create({
      channelId: "ch-1",
      overview: "New overview",
      category: "technology",
    });
    expect(result.version).toBe(2);
  });

  test("handles optional fields", async () => {
    pushMockRows([{ next_version: 1 }], [sampleMetadata]);
    const result = await create({ channelId: "ch-1" });
    expect(result.id).toBe("m-1");
  });
});
