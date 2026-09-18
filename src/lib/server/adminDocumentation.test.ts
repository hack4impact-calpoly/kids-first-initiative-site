import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DOCUMENTATION_PAGES,
  documentationLink,
  loadAdminDocumentation,
  renderDocumentationMarkdown,
} from "./adminDocumentation";

describe("server-only documentation renderer", () => {
  it("renders every allowlisted guide from the actual repository", async () => {
    for (const file of Object.keys(DOCUMENTATION_PAGES)) {
      const html = await loadAdminDocumentation([file]);
      expect(html, file).toContain("<!doctype html>");
      expect(html, file).toContain('href="/adminDashboard"');
      expect(html, file).not.toContain("<script");
    }
  });

  it("preserves guide links, anchors, tables and code blocks", () => {
    const html = renderDocumentationMarkdown(
      "# Guide\n\n## Run the website locally\n\n[Runbook](operations.md#services-and-health)\n\n| A | B |\n| - | - |\n| One | Two |\n\n```sh\nnpm ci\n```",
      "Test",
    );
    expect(html).toContain('id="run-the-website-locally"');
    expect(html).toContain('href="/adminDashboard/docs/operations.md#services-and-health"');
    expect(html).toContain("<table>");
    expect(html).toContain('<code class="language-sh">npm ci');
  });

  it("escapes HTML, disallows dangerous Markdown links, and creates unique heading anchors", () => {
    const html = renderDocumentationMarkdown(
      "# Repeat\n\n# Repeat\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))",
      '<img src=x onerror="alert(1)">',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('id="repeat"');
    expect(html).toContain('id="repeat-1"');
  });

  it("resolves code references to GitHub and never serves repository files directly", () => {
    expect(documentationLink("../src/app/")).toBe(
      "https://github.com/hack4impact-calpoly/kids-first-initiative-site/tree/develop/src/app/",
    );
    expect(documentationLink("../package.json")).toBe(
      "https://github.com/hack4impact-calpoly/kids-first-initiative-site/blob/develop/package.json",
    );
    expect(documentationLink("#accounts-and-roles")).toBe("#accounts-and-roles");
    expect(documentationLink("file:///etc/passwd")).toBe("#");
    expect(documentationLink("//evil.example/path")).toBe("#");
  });
});
