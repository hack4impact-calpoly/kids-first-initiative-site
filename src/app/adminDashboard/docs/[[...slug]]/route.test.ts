import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), readFile: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));

import { GET, HEAD } from "./route";

const context = (slug?: string[]) => ({ params: Promise.resolve({ slug }) });
const request = (method = "GET") => new Request("https://example.com/adminDashboard/docs", { method });

describe("admin documentation authorization", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ userId: "admin_1", sessionClaims: { role: "admin" } });
    mocks.readFile.mockResolvedValue("# Private handoff\n\nConfidential test document.");
  });

  it.each([undefined, ["index.html"], ["handoff.md"], ["styles.css"], ["bundle.js"]])(
    "rejects anonymous requests before reading any file: %j",
    async (slug) => {
      mocks.auth.mockResolvedValue({ userId: null, sessionClaims: null });
      const response = await GET(request(), context(slug));
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain("Confidential");
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(mocks.readFile).not.toHaveBeenCalled();
    },
  );

  it.each(["player", "parent", "educator", "ADMIN", null, undefined])(
    "denies signed-in non-admin role %s",
    async (role) => {
      mocks.auth.mockResolvedValue({ userId: "user_1", sessionClaims: { role } });
      for (const slug of [undefined, ["index.html"], ["operations.md"]]) {
        expect((await GET(request(), context(slug))).status).toBe(403);
      }
      expect(mocks.readFile).not.toHaveBeenCalled();
    },
  );

  it("requires a signed-in user even if the role says admin", async () => {
    mocks.auth.mockResolvedValue({ userId: null, sessionClaims: { role: "admin" } });
    expect((await GET(request(), context())).status).toBe(401);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("serves rendered guides to admins with private, non-cacheable headers", async () => {
    const response = await GET(request(), context(["handoff.md"]));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<h1 id="private-handoff">Private handoff</h1>');
    expect(mocks.readFile).toHaveBeenCalledWith(expect.stringMatching(/\/docs\/handoff\.md$/), "utf8");
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe("no-store");
    expect(response.headers.get("CDN-Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(response.headers.get("Vary")).toBe("Cookie, Authorization");
  });

  it("serves the overview and keeps its guide links inside the protected route", async () => {
    mocks.readFile.mockResolvedValue('<html><main><a href="handoff.md">Checklist</a></main></html>');
    const response = await GET(request(), context());
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('href="/adminDashboard/docs/handoff.md"');
    expect(body).toContain('href="/adminDashboard"');
  });

  it.each([
    ["..", ".env.local"],
    ["../README.md"],
    ["%2e%2e%2f.env.local"],
    ["handbook.md", "extra"],
    ["/etc/passwd"],
    ["handbook.md\u0000"],
    ["__proto__"],
    ["constructor"],
    ["styles.css"],
    ["bundle.js"],
    ["README.md"],
    ["unknown.md"],
  ])("does not resolve arbitrary paths even for admins: %j", async (...slug) => {
    const response = await GET(request(), context(slug));
    expect(response.status).toBe(404);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("rechecks auth on every request, including after role removal", async () => {
    expect((await GET(request(), context(["handoff.md"]))).status).toBe(200);
    mocks.auth.mockResolvedValue({ userId: "admin_1", sessionClaims: { role: "educator" } });
    expect((await GET(request(), context(["handoff.md"]))).status).toBe(403);
    expect(mocks.readFile).toHaveBeenCalledTimes(1);
  });

  it("does not trust role/query/header hints or RSC prefetch requests", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1", sessionClaims: { role: "player" } });
    const spoof = new Request("https://example.com/adminDashboard/docs/handoff.md?role=admin&_rsc=test", {
      headers: { "x-role": "admin", RSC: "1", "Next-Router-Prefetch": "1" },
    });
    expect((await GET(spoof, context(["handoff.md"]))).status).toBe(403);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("authenticates HEAD requests without returning document contents", async () => {
    let response = await HEAD(request("HEAD"), context(["handoff.md"]));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    mocks.readFile.mockClear();
    mocks.auth.mockResolvedValue({ userId: null, sessionClaims: null });
    response = await HEAD(request("HEAD"), context(["handoff.md"]));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("");
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("fails closed if authentication is unavailable", async () => {
    mocks.auth.mockRejectedValue(new Error("private auth failure"));
    const response = await GET(request(), context());
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Documentation is temporarily unavailable.");
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("does not leak server paths on a file error", async () => {
    mocks.readFile.mockRejectedValue(new Error("/private/server/docs/handoff.md"));
    const response = await GET(request(), context(["handoff.md"]));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("/private/server");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
