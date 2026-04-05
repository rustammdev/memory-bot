import { describe, test, expect, mock } from "bun:test";

const chatCompletionFn = mock(() => Promise.resolve("{}"));

mock.module("../client", () => ({
  chatCompletion: chatCompletionFn,
  parseJsonResponse: (content: string) => JSON.parse(content),
}));

import { extractKnowledge } from "../extract-knowledge";

function setMockResponse(data: unknown): void {
  const json = JSON.stringify(data);
  chatCompletionFn.mockImplementation(() => Promise.resolve(json));
}

describe("extractKnowledge", () => {
  test("extracts entities and relationships from summaries", async () => {
    setMockResponse({
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

    const result = await extractKnowledge(
      [{ title: "React Tutorial", summary: "React Hooks allow you to use state in functional components" }],
      "technology",
    );

    expect(result.entities.length).toBe(3);
    expect(result.entities[0]!.label).toBe("React Hooks");
    expect(result.entities[0]!.type).toBe("concept");
    expect(result.relationships.length).toBe(2);
    expect(result.relationships[0]!.source).toBe("React Hooks");
    expect(result.relationships[0]!.target).toBe("useState");
  });

  test("filters entities with invalid types", async () => {
    setMockResponse({
      entities: [
        { label: "React", type: "concept", description: "UI library" },
        { label: "Bad", type: "invalid_type", description: "Should be filtered" },
      ],
      relationships: [],
    });

    const result = await extractKnowledge(
      [{ title: "Video", summary: "React is great" }],
      "tech",
    );

    expect(result.entities.length).toBe(1);
    expect(result.entities[0]!.label).toBe("React");
  });

  test("filters relationships with invalid types", async () => {
    setMockResponse({
      entities: [
        { label: "React", type: "framework", description: "A JavaScript library for building user interfaces" },
        { label: "Vue", type: "framework", description: "A progressive JavaScript framework for building UIs" },
      ],
      relationships: [
        { source: "React", target: "Vue", type: "bad_relation", context: "both UI" },
        { source: "React", target: "Vue", type: "alternative_to", context: "both UI" },
      ],
    });

    const result = await extractKnowledge(
      [{ title: "Frameworks", summary: "React vs Vue" }],
      "tech",
    );

    expect(result.relationships.length).toBe(1);
    expect(result.relationships[0]!.type).toBe("alternative_to");
  });

  test("filters self-referencing relationships", async () => {
    setMockResponse({
      entities: [{ label: "React", type: "framework", description: "A JavaScript library for building UIs" }],
      relationships: [
        { source: "React", target: "React", type: "related_to", context: "self" },
      ],
    });

    const result = await extractKnowledge(
      [{ title: "Video", summary: "React" }],
      "tech",
    );

    expect(result.relationships.length).toBe(0);
  });

  test("filters entities with too short labels", async () => {
    setMockResponse({
      entities: [
        { label: "A", type: "concept", description: "A single letter label that is too short" },
        { label: "AI", type: "concept", description: "Artificial intelligence, machine learning systems" },
      ],
      relationships: [],
    });

    const result = await extractKnowledge(
      [{ title: "Video", summary: "AI and stuff" }],
      "tech",
    );

    expect(result.entities.length).toBe(1);
    expect(result.entities[0]!.label).toBe("AI");
  });

  test("truncates long descriptions", async () => {
    const longDesc = "x".repeat(300);
    setMockResponse({
      entities: [{ label: "React", type: "framework", description: longDesc }],
      relationships: [],
    });

    const result = await extractKnowledge(
      [{ title: "Video", summary: "React" }],
      "tech",
    );

    expect(result.entities[0]!.description.length).toBeLessThanOrEqual(200);
  });

  test("filters relationships referencing non-existent entities", async () => {
    setMockResponse({
      entities: [{ label: "React", type: "framework", description: "A JavaScript library for building UIs" }],
      relationships: [
        { source: "React", target: "Vue", type: "alternative_to", context: "Vue not in entities" },
      ],
    });

    const result = await extractKnowledge(
      [{ title: "Video", summary: "React" }],
      "tech",
    );

    expect(result.relationships.length).toBe(0);
  });

  test("handles multiple videos in single batch", async () => {
    setMockResponse({
      entities: [
        { label: "React", type: "framework", description: "A JavaScript library for building user interfaces" },
        { label: "TypeScript", type: "language", description: "A typed superset of JavaScript that compiles to plain JS" },
      ],
      relationships: [
        { source: "TypeScript", target: "React", type: "used_with", context: "TS with React" },
      ],
    });

    const result = await extractKnowledge(
      [
        { title: "React Tutorial", summary: "React Hooks for state management" },
        { title: "TS Basics", summary: "TypeScript generics and type inference" },
      ],
      "technology",
    );

    expect(result.entities.length).toBe(2);
    expect(result.relationships.length).toBe(1);
  });
});
