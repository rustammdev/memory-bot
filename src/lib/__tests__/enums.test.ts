import { describe, test, expect } from "bun:test";
import { CHANNEL_CATEGORIES, CHANNEL_LANGUAGES } from "../enums";

describe("CHANNEL_CATEGORIES", () => {
  test("contains 10 categories", () => {
    expect(CHANNEL_CATEGORIES.length).toBe(10);
  });

  test("includes expected categories", () => {
    expect(CHANNEL_CATEGORIES).toContain("technology");
    expect(CHANNEL_CATEGORIES).toContain("education");
    expect(CHANNEL_CATEGORIES).toContain("entertainment");
    expect(CHANNEL_CATEGORIES).toContain("gaming");
    expect(CHANNEL_CATEGORIES).toContain("other");
  });

  test("is a readonly tuple", () => {
    const categories: readonly string[] = CHANNEL_CATEGORIES;
    expect(Array.isArray(categories)).toBe(true);
  });
});

describe("CHANNEL_LANGUAGES", () => {
  test("contains 13 languages", () => {
    expect(CHANNEL_LANGUAGES.length).toBe(13);
  });

  test("includes expected languages", () => {
    expect(CHANNEL_LANGUAGES).toContain("en");
    expect(CHANNEL_LANGUAGES).toContain("uz");
    expect(CHANNEL_LANGUAGES).toContain("ru");
    expect(CHANNEL_LANGUAGES).toContain("other");
  });
});
