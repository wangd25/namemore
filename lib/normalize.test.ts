import { describe, expect, it } from "vitest";

import {
  getSurname,
  normalizeAnswer,
  toStableAnswerId,
  withoutNameSuffix,
} from "@/lib/normalize";

describe("normalizeAnswer", () => {
  it("normalizes case and repeated whitespace", () => {
    expect(normalizeAnswer("  STEPHEN   Curry  ")).toBe("stephen curry");
  });

  it("normalizes punctuation, apostrophes, and dashes", () => {
    expect(normalizeAnswer("D’Angelo—Russell!")).toBe("d angelo russell");
  });

  it("removes diacritics deterministically", () => {
    expect(normalizeAnswer("Nikola Jokić")).toBe("nikola jokic");
    expect(normalizeAnswer("Luka Dončić")).toBe("luka doncic");
  });
});

describe("name helpers", () => {
  it("removes supported suffixes before finding a surname", () => {
    expect(withoutNameSuffix("Jaren Jackson Jr.")).toBe("jaren jackson");
    expect(getSurname("Jimmy Butler III")).toBe("butler");
  });

  it("creates stable normalized answer IDs", () => {
    expect(toStableAnswerId("Shai Gilgeous-Alexander")).toBe(
      "shai-gilgeous-alexander",
    );
  });
});
