import { describe, test, expect, mock } from "bun:test";

const validResponse = JSON.stringify({
  entities: [
    { label: "React Hooks", type: "concept", description: "State management in React" },
    { label: "TypeScript", type: "language", description: "Typed JavaScript" },
    { label: "useState", type: "method", description: "React state hook" },
  ],
  relationships: [
    { source: "React Hooks", target: "useState", type: "part_of", context: "useState is a hook" },
    { source: "TypeScript", target: "React Hooks", type: "used_with", context: "TS with React" },
  ],
});

mock.module("../client", () => ({
  chatCompletion: () => Promise.resolve(validResponse),
  parseJsonResponse: (content: string) => JSON.parse(content),
}));

import { extractKnowledge } from "../extract-knowledge";

describe("extractKnowledge", () => {
  test("extracts entities and relationships from chunks", async () => {
    const result = await extractKnowledge("React Tutorial", "technology", [
      { content: "React Hooks allow you to use state in functional components", chunkId: "c1" },
    ]);

    expect(result.entities.length).toBe(3);
    expect(result.entities[0]!.label).toBe("React Hooks");
    expect(result.entities[0]!.type).toBe("concept");
    expect(result.relationships.length).toBe(2);
    expect(result.relationships[0]!.source).toBe("React Hooks");
    expect(result.relationships[0]!.target).toBe("useState");
  });

  test("filters entities with invalid types", async () => {
    const responseWithBadTypes = JSON.stringify({
      entities: [
        { label: "React", type: "concept", description: "UI library" },
        { label: "Bad", type: "invalid_type", description: "Should be filtered" },
      ],
      relationships: [],
    });

    mock.module("../client", () => ({
      chatCompletion: () => Promise.resolve(responseWithBadTypes),
      parseJsonResponse: (content: string) => JSON.parse(content),
    }));

    const { extractKnowledge: extract2 } = await import("../extract-knowledge");
    const result = await extract2("Video", "tech", [
      { content: "React is great", chunkId: "c1" },
    ]);

    expect(result.entities.length).toBe(1);
    expect(result.entities[0]!.label).toBe("React");
  });

  test("filters relationships with invalid types", async () => {
    const responseWithBadRel = JSON.stringify({
      entities: [
        { label: "React", type: "framework", description: "UI lib" },
        { label: "Vue", type: "framework", description: "UI lib" },
      ],
      relationships: [
        { source: "React", target: "Vue", type: "bad_relation", context: "both UI" },
        { source: "React", target: "Vue", type: "alternative_to", context: "both UI" },
      ],
    });

    mock.module("../client", () => ({
      chatCompletion: () => Promise.resolve(responseWithBadRel),
      parseJsonResponse: (content: string) => JSON.parse(content),
    }));

    const { extractKnowledge: extract3 } = await import("../extract-knowledge");
    const result = await extract3("Frameworks", "tech", [
      { content: "React vs Vue", chunkId: "c1" },
    ]);

    expect(result.relationships.length).toBe(1);
    expect(result.relationships[0]!.type).toBe("alternative_to");
  });

  test("filters self-referencing relationships", async () => {
    const responseWithSelfRef = JSON.stringify({
      entities: [{ label: "React", type: "framework", description: "UI" }],
      relationships: [
        { source: "React", target: "React", type: "related_to", context: "self" },
      ],
    });

    mock.module("../client", () => ({
      chatCompletion: () => Promise.resolve(responseWithSelfRef),
      parseJsonResponse: (content: string) => JSON.parse(content),
    }));

    const { extractKnowledge: extract4 } = await import("../extract-knowledge");
    const result = await extract4("Video", "tech", [
      { content: "React", chunkId: "c1" },
    ]);

    expect(result.relationships.length).toBe(0);
  });

  test("filters entities with too short labels", async () => {
    const responseWithShort = JSON.stringify({
      entities: [
        { label: "A", type: "concept", description: "Too short" },
        { label: "AI", type: "concept", description: "Just right" },
      ],
      relationships: [],
    });

    mock.module("../client", () => ({
      chatCompletion: () => Promise.resolve(responseWithShort),
      parseJsonResponse: (content: string) => JSON.parse(content),
    }));

    const { extractKnowledge: extract5 } = await import("../extract-knowledge");
    const result = await extract5("Video", "tech", [
      { content: "AI and stuff", chunkId: "c1" },
    ]);

    expect(result.entities.length).toBe(1);
    expect(result.entities[0]!.label).toBe("AI");
  });

  test("truncates long descriptions", async () => {
    const longDesc = "x".repeat(300);
    const response = JSON.stringify({
      entities: [{ label: "React", type: "framework", description: longDesc }],
      relationships: [],
    });

    mock.module("../client", () => ({
      chatCompletion: () => Promise.resolve(response),
      parseJsonResponse: (content: string) => JSON.parse(content),
    }));

    const { extractKnowledge: extract6 } = await import("../extract-knowledge");
    const result = await extract6("Video", "tech", [
      { content: "React", chunkId: "c1" },
    ]);

    expect(result.entities[0]!.description.length).toBeLessThanOrEqual(200);
  });

  test("filters relationships referencing non-existent entities", async () => {
    const response = JSON.stringify({
      entities: [{ label: "React", type: "framework", description: "UI" }],
      relationships: [
        { source: "React", target: "Vue", type: "alternative_to", context: "Vue not in entities" },
      ],
    });

    mock.module("../client", () => ({
      chatCompletion: () => Promise.resolve(response),
      parseJsonResponse: (content: string) => JSON.parse(content),
    }));

    const { extractKnowledge: extract7 } = await import("../extract-knowledge");
    const result = await extract7("Video", "tech", [
      { content: "React", chunkId: "c1" },
    ]);

    expect(result.relationships.length).toBe(0);
  });
});
