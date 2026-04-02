import { describe, test, expect, beforeEach } from "bun:test";
import { pushMockRows, clearMockRows } from "../../__test-utils__/db-mock";
import {
  createBuild,
  updateProgress,
  completeBuild,
  failBuild,
  findLatestBuild,
  markVideoProcessed,
  findProcessedVideoIds,
  clearProcessedVideos,
  markStaleBuildsFailed,
  type KnowledgeBuildRow,
} from "../knowledge-build.repo";

const now = new Date("2025-06-01");

const sampleBuild: KnowledgeBuildRow = {
  id: "build-1",
  channel_id: "ch-1",
  status: "running",
  total_videos: 10,
  processed_videos: 3,
  error: null,
  started_at: now,
  completed_at: null,
};

beforeEach(() => {
  clearMockRows();
});

describe("createBuild", () => {
  test("returns created build row", async () => {
    pushMockRows([sampleBuild]);
    const result = await createBuild("ch-1", 10);
    expect(result.id).toBe("build-1");
    expect(result.status).toBe("running");
    expect(result.total_videos).toBe(10);
  });
});

describe("updateProgress", () => {
  test("completes without error", async () => {
    pushMockRows([]);
    await updateProgress("build-1", 5);
  });
});

describe("completeBuild", () => {
  test("completes without error", async () => {
    pushMockRows([]);
    await completeBuild("build-1");
  });
});

describe("failBuild", () => {
  test("completes without error", async () => {
    pushMockRows([]);
    await failBuild("build-1", "Something went wrong");
  });
});

describe("findLatestBuild", () => {
  test("returns latest build when exists", async () => {
    pushMockRows([sampleBuild]);
    const result = await findLatestBuild("ch-1");
    expect(result).toEqual(sampleBuild);
  });

  test("returns null when no builds", async () => {
    pushMockRows([]);
    const result = await findLatestBuild("ch-empty");
    expect(result).toBeNull();
  });
});

describe("markVideoProcessed", () => {
  test("completes without error", async () => {
    pushMockRows([]);
    await markVideoProcessed("ch-1", "vid-1");
  });
});

describe("findProcessedVideoIds", () => {
  test("returns set of video IDs", async () => {
    pushMockRows([{ video_id: "vid-1" }, { video_id: "vid-2" }]);
    const result = await findProcessedVideoIds("ch-1");
    expect(result.size).toBe(2);
    expect(result.has("vid-1")).toBe(true);
    expect(result.has("vid-2")).toBe(true);
  });

  test("returns empty set when none processed", async () => {
    pushMockRows([]);
    const result = await findProcessedVideoIds("ch-empty");
    expect(result.size).toBe(0);
  });
});

describe("clearProcessedVideos", () => {
  test("completes without error", async () => {
    pushMockRows([]);
    await clearProcessedVideos("ch-1");
  });
});

describe("markStaleBuildsFailed", () => {
  test("completes without error", async () => {
    pushMockRows([]);
    await markStaleBuildsFailed("ch-1");
  });
});
