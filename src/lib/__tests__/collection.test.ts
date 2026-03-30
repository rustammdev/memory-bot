import { describe, test, expect } from "bun:test";
import { deduplicateByKey } from "../collection";

describe("deduplicateByKey", () => {
  test("returns empty array for empty input", () => {
    const result = deduplicateByKey([], (x) => String(x));
    expect(result).toEqual([]);
  });

  test("deduplicates by key function", () => {
    const items = [
      { id: "a", name: "Alice" },
      { id: "b", name: "Bob" },
      { id: "a", name: "Alice2" },
    ];
    const result = deduplicateByKey(items, (i) => i.id);
    expect(result).toEqual([
      { id: "a", name: "Alice" },
      { id: "b", name: "Bob" },
    ]);
  });

  test("keeps first occurrence when duplicates exist", () => {
    const items = [
      { vid: "v1", score: 10 },
      { vid: "v1", score: 20 },
      { vid: "v2", score: 30 },
    ];
    const result = deduplicateByKey(items, (i) => i.vid);
    expect(result.length).toBe(2);
    expect(result[0]!.score).toBe(10);
  });

  test("returns all items when no duplicates", () => {
    const items = [
      { id: "1", val: "x" },
      { id: "2", val: "y" },
      { id: "3", val: "z" },
    ];
    const result = deduplicateByKey(items, (i) => i.id);
    expect(result).toEqual(items);
  });

  test("works with string arrays", () => {
    const items = ["apple", "banana", "apple", "cherry"];
    const result = deduplicateByKey(items, (s) => s);
    expect(result).toEqual(["apple", "banana", "cherry"]);
  });
});
