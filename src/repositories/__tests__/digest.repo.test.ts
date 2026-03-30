import { describe, test, expect, beforeEach } from "bun:test";
import { pushMockRows, clearMockRows } from "../../__test-utils__/db-mock";
import {
  findLatest,
  findByVersion,
  findAll,
  findPrevious,
  create,
  updateById,
  type DigestRow,
} from "../digest.repo";

const sampleDigest: DigestRow = {
  id: "d-1",
  channel_id: "ch-1",
  version: 1,
  status: "completed",
  period_start: new Date("2025-01-01"),
  period_end: new Date("2025-01-07"),
  new_video_count: 5,
  total_views: 50000,
  summary: "Weekly digest summary",
  highlights: [
    { videoId: "v-1", title: "Top Video", reason: "Highest views", viewVelocity: 1000 },
  ],
  topic_clusters: [
    { topic: "TypeScript", videoIds: ["v-1"], description: "TS content" },
  ],
  trend_analysis: "Views are up 20%",
  persona_style: "tech_enthusiast",
  generated_at: new Date("2025-01-07"),
  error_message: null,
  created_at: new Date("2025-01-01"),
};

beforeEach(() => {
  clearMockRows();
});

describe("findLatest", () => {
  test("returns latest completed digest", async () => {
    pushMockRows([sampleDigest]);
    const result = await findLatest("ch-1");
    expect(result).toEqual(sampleDigest);
  });

  test("returns null when none exists", async () => {
    pushMockRows([]);
    const result = await findLatest("ch-none");
    expect(result).toBeNull();
  });
});

describe("findByVersion", () => {
  test("returns digest for version", async () => {
    pushMockRows([sampleDigest]);
    const result = await findByVersion("ch-1", 1);
    expect(result).toEqual(sampleDigest);
  });

  test("returns null for missing version", async () => {
    pushMockRows([]);
    const result = await findByVersion("ch-1", 999);
    expect(result).toBeNull();
  });
});

describe("findAll", () => {
  test("returns all digests", async () => {
    pushMockRows([sampleDigest]);
    const result = await findAll("ch-1");
    expect(result.length).toBe(1);
  });
});

describe("findPrevious", () => {
  test("returns previous completed digest", async () => {
    pushMockRows([sampleDigest]);
    const result = await findPrevious("ch-1", 2);
    expect(result).toEqual(sampleDigest);
  });

  test("returns null when no previous", async () => {
    pushMockRows([]);
    const result = await findPrevious("ch-1", 1);
    expect(result).toBeNull();
  });
});

describe("create", () => {
  test("creates digest with auto-version", async () => {
    pushMockRows([{ next_version: 2 }], [{ ...sampleDigest, version: 2 }]);
    const result = await create({
      channelId: "ch-1",
      periodStart: new Date("2025-01-08"),
      periodEnd: new Date("2025-01-14"),
      newVideoCount: 3,
      totalViews: 30000,
      personaStyle: "tech_enthusiast",
    });
    expect(result.version).toBe(2);
  });
});

describe("updateById", () => {
  test("updates digest status and content", async () => {
    pushMockRows([{ ...sampleDigest, status: "completed" }]);
    const result = await updateById("d-1", {
      status: "completed",
      summary: "Updated summary",
    });
    expect(result.status).toBe("completed");
  });

  test("updates with highlights", async () => {
    pushMockRows([sampleDigest]);
    const result = await updateById("d-1", {
      status: "completed",
      highlights: [
        { videoId: "v-2", title: "New Top", reason: "Viral", viewVelocity: 5000 },
      ],
    });
    expect(result).toBeDefined();
  });
});
