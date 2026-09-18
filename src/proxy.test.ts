import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { getClerkProxyUrl } from "@/lib/clerkProxy";

const appOrigin = "https://kids-first-initiative-site.vercel.app";
// Synthetic keys only; every upstream request is intercepted below.
const productionKey = `pk_live_${Buffer.from("clerk.example.com$").toString("base64")}`;
const developmentKey = `pk_test_${Buffer.from("example.clerk.accounts.dev$").toString("base64")}`;
const secretKey = "sk_live_proxy_test_placeholder";
const event = { waitUntil: vi.fn() } as unknown as NextFetchEvent;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", productionKey);
  vi.stubEnv("CLERK_SECRET_KEY", secretKey);
  vi.stubEnv("CLERK_FAPI_URL", "");
  vi.stubEnv("KFI_E2E_BYPASS_CLERK", "");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Clerk proxy configuration", () => {
  it("selects the proxy by instance key, including production builds with test keys", () => {
    expect(getClerkProxyUrl(productionKey)).toBe("/__clerk");
    expect(getClerkProxyUrl(developmentKey)).toBeUndefined();
    expect(getClerkProxyUrl(undefined)).toBeUndefined();
    expect(getClerkProxyUrl("")).toBeUndefined();
  });

  it("matches Clerk API and JavaScript paths without intercepting ordinary assets", async () => {
    const { config } = await import("./proxy");
    for (const path of [
      "/__clerk",
      "/__clerk/v1/environment",
      "/__clerk/npm/@clerk/clerk-js@6/dist/clerk.browser.js",
      "/api/users/me",
      "/adminDashboard",
    ]) {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path }), path).toBe(true);
    }
    for (const path of ["/_next/static/chunk.js", "/logo.png", "/game/loader.js"]) {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path }), path).toBe(false);
    }
  });
});

describe("Clerk production proxy", () => {
  it("forwards unauthenticated requests and preserves query, body, cookies, and status", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(
      new Response('{"status":"complete"}', {
        status: 201,
        headers: {
          "content-type": "application/json",
          "set-cookie": "__client=test-session; Path=/; Secure; HttpOnly",
        },
      }),
    );
    const { default: proxy } = await import("./proxy");
    const response = await proxy(
      new NextRequest(`${appOrigin}/__clerk/v1/client/sign_ins?__clerk_api_version=test`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: "__client=previous-session",
          "x-real-ip": "203.0.113.10",
          "clerk-secret-key": "untrusted-client-value",
        },
        body: "identifier=synthetic%40example.com",
      }),
      event,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://frontend-api.clerk.dev/v1/client/sign_ins?__clerk_api_version=test");
    expect(options).toMatchObject({ method: "POST", redirect: "manual" });
    const headers = new Headers(options?.headers);
    expect(headers.get("clerk-proxy-url")).toBe(`${appOrigin}/__clerk`);
    expect(headers.get("clerk-secret-key")).toBe(secretKey);
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.10");
    expect(headers.get("cookie")).toBe("__client=previous-session");
    expect(await new Response(options?.body).text()).toBe("identifier=synthetic%40example.com");
    expect(response?.status).toBe(201);
    expect(response?.headers.get("set-cookie")).toContain("__client=test-session");
    expect(response?.headers.has("clerk-secret-key")).toBe(false);
    expect(await response?.json()).toEqual({ status: "complete" });
  });

  it("routes Clerk JavaScript through the SDK even if the test bypass is set in production", async () => {
    vi.stubEnv("KFI_E2E_BYPASS_CLERK", "1");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("/* Clerk script */", { headers: { "content-type": "application/javascript" } }),
    );
    const { default: proxy } = await import("./proxy");
    const path = "/npm/@clerk/clerk-js@6/dist/clerk.browser.js";
    const response = await proxy(new NextRequest(`${appOrigin}/__clerk${path}`), event);
    expect(fetch).toHaveBeenCalledWith(`https://frontend-api.clerk.dev${path}`, expect.any(Object));
    expect(response?.headers.get("content-type")).toBe("application/javascript");
    expect(await response?.text()).toBe("/* Clerk script */");
  });

  it("keeps Clerk redirects on the application's proxy path", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 307,
        headers: { location: "https://frontend-api.clerk.dev/v1/client?step=next" },
      }),
    );
    const { default: proxy } = await import("./proxy");
    const response = await proxy(new NextRequest(`${appOrigin}/__clerk/v1/client`), event);
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(`${appOrigin}/__clerk/v1/client?step=next`);
  });

  it("cannot send the server secret to a host supplied in the request path", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}"));
    const { default: proxy } = await import("./proxy");
    await proxy(new NextRequest(`${appOrigin}/__clerk//untrusted.example/v1/client`), event);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new URL(String(vi.mocked(fetch).mock.calls[0][0])).host).toBe("frontend-api.clerk.dev");
  });
});

describe.each([
  ["production", productionKey, secretKey],
  ["development", developmentKey, "sk_test_proxy_test_placeholder"],
])("application authorization with %s Clerk keys", (_instance, publishableKey, key) => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", publishableKey);
    vi.stubEnv("CLERK_SECRET_KEY", key);
  });

  it.each([
    "/api/users/me",
    "/api/auth/admin-access",
    "/api/admin/analytics",
    "/api/health/private",
    "/api/health-check",
  ])("still rejects anonymous requests to %s", async (path) => {
    const { default: proxy } = await import("./proxy");
    const response = await proxy(new NextRequest(`${appOrigin}${path}`), event);
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({ error: "Unauthorized" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["GET", "HEAD"])("allows an anonymous %s health probe without contacting Clerk", async (method) => {
    // A monitor must still reach the health handler if Clerk is misconfigured or unavailable.
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    const { default: proxy } = await import("./proxy");
    const response = await proxy(new NextRequest(`${appOrigin}/api/health?probe=uptime`, { method }), event);
    expect(response?.status).toBe(200);
    expect(response?.headers.get("x-middleware-next")).toBe("1");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not exempt writes to the health path from authentication", async () => {
    const { default: proxy } = await import("./proxy");
    const response = await proxy(new NextRequest(`${appOrigin}/api/health`, { method: "POST" }), event);
    expect(response?.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still redirects anonymous visitors away from the admin dashboard", async () => {
    const { default: proxy } = await import("./proxy");
    const response = await proxy(new NextRequest(`${appOrigin}/adminDashboard`), event);
    expect(response?.headers.get("location")).toBe(`${appOrigin}/playerDashboard`);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["/login/facilitator", "/sign-up/facilitator", "/api/classroom-sessions/join"])(
    "still allows public or guest-capable route %s to reach its handler",
    async (path) => {
      const { default: proxy } = await import("./proxy");
      const response = await proxy(new NextRequest(`${appOrigin}${path}`), event);
      expect(response?.status).toBe(200);
      expect(response?.headers.get("location")).toBeNull();
      // Clerk forwards auth context to the same route using a Next.js rewrite.
      expect(response?.headers.get("x-middleware-rewrite")).toBe(`${appOrigin}${path}`);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("forwards the Clerk path only for a production instance", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}"));
    const { default: proxy } = await import("./proxy");
    const response = await proxy(new NextRequest(`${appOrigin}/__clerk/v1/environment`), event);
    if (publishableKey === productionKey) {
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(await response?.json()).toEqual({});
    } else {
      expect(fetch).not.toHaveBeenCalled();
      expect(response?.headers.get("x-middleware-rewrite")).toBe(`${appOrigin}/__clerk/v1/environment`);
    }
  });
});
