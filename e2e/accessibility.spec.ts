import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated half of the launch accessibility pass.
 *
 * This runs as a reporting step, not a merge gate (`npm run test:a11y`, its own Playwright project).
 * It surfaces pre-existing WCAG 2.1 A/AA violations and layout overflow so they can be triaged; a
 * permanently red required check would train people to ignore CI instead.
 *
 * It cannot judge whether spoken instructions have usable visual equivalents, whether touch targets
 * are reachable for small hands, or whether a Unity canvas is operable. Keyboard focus visibility is
 * also checked manually: an automated version proved timing-dependent, passing and failing across
 * runs on unchanged pages, and a flaky check is worse than none. Those live in the manual checklist
 * in docs/accessibility-qa.md, which this suite shrinks rather than replaces.
 *
 * Viewports are the real targets from the device matrix, not arbitrary breakpoints: a school
 * Chromebook, an iPad in both orientations, and a small phone.
 */

const VIEWPORTS = [
  { name: "chromebook-1366", width: 1366, height: 768 },
  { name: "ipad-portrait", width: 810, height: 1080 },
  { name: "ipad-landscape", width: 1080, height: 810 },
  { name: "phone-390", width: 390, height: 844 },
] as const;

// Pages a learner or educator reaches without a session. Authenticated pages need seeded state and
// are covered manually for now.
const PUBLIC_PAGES = [
  { name: "home", path: "/" },
  { name: "player sign-in", path: "/login/player" },
  { name: "educator sign-in", path: "/login/facilitator" },
  { name: "parent handoff", path: "/parentHandoff" },
  { name: "shop", path: "/shop" },
];

async function analyze(page: Page) {
  return new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
}

test.describe("WCAG 2.1 AA", () => {
  for (const target of PUBLIC_PAGES) {
    test(`${target.name} has no automatically detectable violations`, async ({ page }) => {
      await page.goto(target.path);
      const results = await analyze(page);

      // Reported per rule with the offending selectors, so a failure names what to fix rather than
      // just counting problems.
      const summary = results.violations.map(
        (violation) =>
          `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
      );
      expect(summary, `Accessibility violations on ${target.path}`).toEqual([]);
    });
  }
});

test.describe("layout at supported viewport sizes", () => {
  for (const target of PUBLIC_PAGES) {
    for (const viewport of VIEWPORTS) {
      test(`${target.name} does not scroll sideways at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(target.path);

        // Horizontal overflow is how text and controls get clipped off-screen on a Chromebook or
        // tablet. A few pixels of tolerance absorbs sub-pixel rounding.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${target.path} overflows horizontally at ${viewport.width}px`).toBeLessThanOrEqual(2);
      });
    }
  }
});

test.describe("motion", () => {
  test("respects a reduced-motion preference", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // Long animations under reduce are the ones that cause discomfort; a short transition is fine.
    const longAnimations = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("*")).filter((element) => {
          const style = window.getComputedStyle(element);
          const duration = Number.parseFloat(style.animationDuration || "0");
          return style.animationName !== "none" && duration > 0.5;
        }).length,
    );

    expect(longAnimations).toBe(0);
  });
});
