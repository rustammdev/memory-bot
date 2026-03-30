import { describe, test, expect, mock } from "bun:test";

const mockGraph = {
  channelName: "Test Channel",
  handle: "@testchannel",
  category: "technology",
  nodeCount: 10,
  edgeCount: 15,
  nodes: [{ id: "n1", label: "React", type: "framework", description: "UI lib", importance: 5, mentionCount: 3 }],
  edges: [{ id: "e1", source: "n1", target: "n2", relationship: "requires", weight: 1, context: null }],
};

const mockNodeDetail = {
  id: "n1",
  label: "React",
  type: "framework",
  description: "UI lib",
  importance: 5,
  mentionCount: 3,
  videos: [{ videoId: "v1", youtubeVideoId: "abc", title: "React Intro", context: null, relevance: 1 }],
  neighbors: [{ nodeId: "n2", label: "Hooks", type: "concept", relationship: "part_of", direction: "outgoing", weight: 1 }],
};

const mockPath = {
  from: "JavaScript",
  to: "React Hooks",
  found: true,
  path: [
    { nodeId: "n1", label: "JavaScript", type: "language", relationship: null },
    { nodeId: "n2", label: "React", type: "framework", relationship: "requires" },
    { nodeId: "n3", label: "React Hooks", type: "concept", relationship: "part_of" },
  ],
  totalSteps: 2,
};

const mockSuggest = {
  node: { id: "n1", label: "React", type: "framework", description: "UI", importance: 5, mentionCount: 3 },
  related: [{ label: "Hooks", type: "concept", relationship: "part_of" }],
  videos: [{ title: "React Intro", youtubeVideoId: "abc123" }],
};

const mockStats = { nodeCount: 10, edgeCount: 15, topTypes: [{ type: "concept", count: 5 }] };

mock.module("../../services/knowledge.service", () => ({
  buildChannelGraph: () => Promise.resolve(mockGraph),
  getChannelGraph: () => Promise.resolve(mockGraph),
  getNodeDetails: (id: string) => {
    if (id === "n1") return Promise.resolve(mockNodeDetail);
    return Promise.resolve(null);
  },
  findLearningPath: () => Promise.resolve(mockPath),
  suggestForTopic: () => Promise.resolve(mockSuggest),
}));

mock.module("../../repositories/knowledge.repo", () => ({
  getGraphStats: () => Promise.resolve(mockStats),
}));

mock.module("../../services/channel.helpers", () => ({
  requireChannel: () =>
    Promise.resolve({ id: "ch-1", name: "Test Channel", username: "@testchannel" }),
}));

import { knowledgeRoutes } from "../knowledge.routes";

interface ApiResponse {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

describe("GET /api/knowledge/graph", () => {
  const handler = knowledgeRoutes["/api/knowledge/graph"].GET;

  test("returns graph data", async () => {
    const req = new Request("http://localhost/api/knowledge/graph?channel=testchannel");
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = (await resp.json()) as ApiResponse;
    expect(body.ok).toBe(true);
    expect((body.data as typeof mockGraph).channelName).toBe("Test Channel");
    expect((body.data as typeof mockGraph).nodeCount).toBe(10);
  });
});

describe("POST /api/knowledge/build", () => {
  const handler = knowledgeRoutes["/api/knowledge/build"].POST;

  test("builds graph and returns result", async () => {
    const req = new Request("http://localhost/api/knowledge/build?channel=testchannel", {
      method: "POST",
    });
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = (await resp.json()) as ApiResponse;
    expect(body.ok).toBe(true);
  });

  test("accepts force parameter", async () => {
    const req = new Request("http://localhost/api/knowledge/build?channel=testchannel&force=true", {
      method: "POST",
    });
    const resp = await handler(req);
    expect(resp.status).toBe(200);
  });
});

describe("GET /api/knowledge/node", () => {
  const handler = knowledgeRoutes["/api/knowledge/node"].GET;

  test("returns node details for valid id", async () => {
    const req = new Request("http://localhost/api/knowledge/node?id=n1");
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = (await resp.json()) as ApiResponse;
    expect(body.ok).toBe(true);
    expect((body.data as typeof mockNodeDetail).label).toBe("React");
    expect((body.data as typeof mockNodeDetail).videos.length).toBe(1);
  });

  test("returns error for missing id param", async () => {
    const req = new Request("http://localhost/api/knowledge/node");
    const resp = await handler(req);

    const body = (await resp.json()) as ApiResponse;
    expect(body.ok).toBe(false);
  });
});

describe("GET /api/knowledge/path", () => {
  const handler = knowledgeRoutes["/api/knowledge/path"].GET;

  test("returns learning path", async () => {
    const req = new Request("http://localhost/api/knowledge/path?channel=testchannel&from=JavaScript&to=React%20Hooks");
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = (await resp.json()) as ApiResponse;
    expect(body.ok).toBe(true);
    expect((body.data as typeof mockPath).found).toBe(true);
    expect((body.data as typeof mockPath).totalSteps).toBe(2);
  });

  test("returns error for missing from param", async () => {
    const req = new Request("http://localhost/api/knowledge/path?channel=testchannel&to=React");
    const resp = await handler(req);

    const body = (await resp.json()) as ApiResponse;
    expect(body.ok).toBe(false);
  });

  test("returns error for missing to param", async () => {
    const req = new Request("http://localhost/api/knowledge/path?channel=testchannel&from=JS");
    const resp = await handler(req);

    const body = (await resp.json()) as ApiResponse;
    expect(body.ok).toBe(false);
  });
});

describe("GET /api/knowledge/suggest", () => {
  const handler = knowledgeRoutes["/api/knowledge/suggest"].GET;

  test("returns suggestions for topic", async () => {
    const req = new Request("http://localhost/api/knowledge/suggest?channel=testchannel&topic=React");
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = (await resp.json()) as ApiResponse;
    expect(body.ok).toBe(true);
    expect((body.data as typeof mockSuggest).related.length).toBe(1);
    expect((body.data as typeof mockSuggest).videos.length).toBe(1);
  });

  test("returns error for missing topic param", async () => {
    const req = new Request("http://localhost/api/knowledge/suggest?channel=testchannel");
    const resp = await handler(req);

    const body = (await resp.json()) as ApiResponse;
    expect(body.ok).toBe(false);
  });
});

describe("GET /api/knowledge/stats", () => {
  const handler = knowledgeRoutes["/api/knowledge/stats"].GET;

  test("returns graph stats with channel name", async () => {
    const req = new Request("http://localhost/api/knowledge/stats?channel=testchannel");
    const resp = await handler(req);
    expect(resp.status).toBe(200);

    const body = (await resp.json()) as ApiResponse;
    expect(body.ok).toBe(true);
    const data = body.data as typeof mockStats & { channelName: string };
    expect(data.channelName).toBe("Test Channel");
    expect(data.nodeCount).toBe(10);
    expect(data.edgeCount).toBe(15);
  });
});
