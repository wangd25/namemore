import { describe, expect, it } from "vitest";

import { readJsonBody } from "@/lib/daily-route";

describe("daily route request limits", () => {
  it("parses a small JSON request", async () => {
    const request = new Request("https://example.test/api/daily/finish", {
      method: "POST",
      body: JSON.stringify({ attemptId: "11111111-1111-4111-8111-111111111111" }),
    });
    await expect(readJsonBody(request)).resolves.toEqual({
      attemptId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("rejects oversized bodies even without a content-length header", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ answer: "x".repeat(2_100) })));
        controller.close();
      },
    });
    const request = new Request("https://example.test/api/daily/submit-answer", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(readJsonBody(request)).resolves.toBeNull();
  });

  it("rejects invalid JSON", async () => {
    const request = new Request("https://example.test/api/daily/finish", {
      method: "POST",
      body: "not-json",
    });
    await expect(readJsonBody(request)).resolves.toBeNull();
  });
});
