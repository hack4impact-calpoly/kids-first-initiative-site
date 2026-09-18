import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import MarkdownIt from "markdown-it";

const DOCS_PATH = "/adminDashboard/docs";
const REPOSITORY = "https://github.com/hack4impact-calpoly/kids-first-initiative-site";

// This is a file allowlist, not a filesystem browser. Never pass request paths to readFile.
export const DOCUMENTATION_PAGES = {
  "index.html": "Handoff overview",
  "partner-guide.md": "Partner and educator guide",
  "handbook.md": "Developer handbook",
  "handoff.md": "Handoff checklist",
  "releases.md": "Releases",
  "operations.md": "Operations runbook",
  "accessibility-qa.md": "Accessibility and device QA",
  "api-authorization.md": "API authorization",
  "game-progress-bridge.md": "Unity progress contract",
} as const;

export const DOCUMENTATION_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Cookie, Authorization",
};

const styles = `
  :root { color-scheme: light; font-family: system-ui, sans-serif; color: #211e46; background: #f5f6fa; line-height: 1.65; }
  * { box-sizing: border-box; }
  body { margin: 0; }
  main { max-width: 1100px; padding: 32px 24px 64px; margin: auto; }
  nav { display: flex; flex-wrap: wrap; gap: 12px 24px; margin-bottom: 28px; }
  article { min-width: 0; padding: 24px; border: 1px solid #dcddea; border-radius: 12px; background: white; overflow-wrap: anywhere; }
  h1, h2, h3 { color: #2a256f; line-height: 1.25; scroll-margin-top: 20px; }
  h1 { font-size: clamp(1.8rem, 5vw, 2.6rem); }
  h2 { margin-top: 32px; }
  a { color: #294f9a; text-underline-offset: .16em; overflow-wrap: anywhere; }
  a:focus-visible { outline: 3px solid #294f9a; outline-offset: 4px; }
  pre { overflow-x: auto; padding: 16px; background: #f5f6fa; border-radius: 8px; }
  code { font-size: .9em; }
  table { display: block; overflow-x: auto; border-collapse: collapse; margin: 20px 0; }
  th, td { border: 1px solid #dcddea; padding: 10px 12px; text-align: left; vertical-align: top; min-width: 140px; }
  li { margin: 6px 0; }
  .access-note { color: #56576c; font-size: .9rem; }
  @media (max-width: 600px) { main { padding: 24px 12px; } article { padding: 16px; } }
  @media print { nav { display: none; } main, article { padding: 0; border: 0; } table { display: table; } }
`;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

// Keep guide links behind the same gate; code references open the repository, never local files.
export function documentationLink(href: string): string {
  if (href.startsWith("#")) return href;
  if (/^https?:\/\//i.test(href)) return href;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return "#";
  if (href.startsWith("/")) return href;
  const resolved = new URL(href, "https://documentation.invalid/docs/");
  const file = resolved.pathname.slice("/docs/".length);
  if (resolved.pathname.startsWith("/docs/") && Object.hasOwn(DOCUMENTATION_PAGES, file)) {
    return `${DOCS_PATH}/${file}${resolved.hash}`;
  }
  const kind = resolved.pathname.endsWith("/") ? "tree" : "blob";
  return `${REPOSITORY}/${kind}/develop${resolved.pathname}${resolved.hash}`;
}

export function renderDocumentationMarkdown(source: string, title: string): string {
  // Raw HTML is disabled; no scripts, embedded assets, or client-side Markdown rendering.
  const markdown = new MarkdownIt({ html: false, linkify: false });
  const slugs = new Map<string, number>();
  markdown.renderer.rules.heading_open = (tokens, index, options, _env, renderer) => {
    const inline = tokens[index + 1];
    const text = inline.children?.map((token) => token.content).join("") ?? inline.content;
    const slug = text.toLowerCase().replace(new RegExp("[^\\p{L}\\p{N}\\s_-]", "gu"), "").replace(/\s/g, "-");
    const count = slugs.get(slug) ?? 0;
    slugs.set(slug, count + 1);
    tokens[index].attrSet("id", count ? `${slug}-${count}` : slug);
    return renderer.renderToken(tokens, index, options);
  };
  markdown.renderer.rules.link_open = (tokens, index, options, _env, renderer) => {
    tokens[index].attrSet("href", documentationLink(String(tokens[index].attrGet("href") ?? "#")));
    return renderer.renderToken(tokens, index, options);
  };
  const body = markdown.render(source);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} · Kids First Initiative</title><style>${styles}</style></head><body><main><nav aria-label="Documentation navigation"><a href="/adminDashboard">← Admin dashboard</a><a href="${DOCS_PATH}">Documentation overview</a></nav><p class="access-note">Admin-only website view. Repository copies remain public; never store credentials in these guides.</p><article>${body}</article></main></body></html>`;
}

// Only call after server-side authorization. The server-only import also prevents client imports.
export async function loadAdminDocumentation(slug: string[] | undefined): Promise<string | null> {
  if (slug && slug.length !== 1) return null;
  const file = slug?.[0] ?? "index.html";
  if (!Object.hasOwn(DOCUMENTATION_PAGES, file)) return null;
  const source = await readFile(path.join(process.cwd(), "docs", file), "utf8");
  if (file === "index.html") {
    return source
      .replace(/href="([^"]+)"/g, (_match, href: string) => `href="${escapeHtml(documentationLink(href))}"`)
      .replace(
        "<main>",
        '<main><nav aria-label="Admin navigation"><a href="/adminDashboard">← Admin dashboard</a></nav>',
      );
  }
  return renderDocumentationMarkdown(source, DOCUMENTATION_PAGES[file as keyof typeof DOCUMENTATION_PAGES]);
}
