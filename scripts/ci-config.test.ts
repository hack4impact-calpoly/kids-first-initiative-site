import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const workflow = (name: string) => readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("CI service isolation", () => {
  it("does not load repository secrets or variables into web CI", () => {
    expect(workflow("ci")).not.toMatch(/\$\{\{\s*(?:secrets|vars)[.\[]/);
  });

  it("retains only the required Unity license secrets in the Unity workflow", () => {
    const names = Array.from(workflow("build-unity-webgl").matchAll(/\bsecrets\.([A-Z_]+)/g))
      .map((match) => match[1])
      .sort();
    expect(names).toEqual(["UNITY_EMAIL", "UNITY_PASSWORD", "UNITY_SERIAL"]);
    expect(workflow("build-unity-webgl")).not.toMatch(/\$\{\{\s*vars[.\[]/);
  });

  it.each(["ci", "build-unity-webgl"])("uses only dummy service settings in %s", (name) => {
    const text = workflow(name);
    expect(text).toContain("MONGO_URI: mongodb://127.0.0.1:27017/kfi-ci");
    expect(text).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_Y2xlcmsuZXhhbXBsZS5jb20k");
    expect(text).toContain("CLERK_SECRET_KEY: sk_test_placeholder");
  });

  it("overrides inherited service credentials when starting the browser-test server", async () => {
    vi.stubEnv("MONGO_URI", "mongodb://production.example.invalid/never-use");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_live_never_use");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_live_never_use");
    const { default: config } = await import("../playwright.config");
    expect(config.webServer).toMatchObject({
      env: {
        KFI_E2E_BYPASS_CLERK: "1",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k",
        CLERK_SECRET_KEY: "sk_test_placeholder",
        MONGO_URI: "mongodb://127.0.0.1:27017/kfi-playwright",
      },
    });
  });
});
