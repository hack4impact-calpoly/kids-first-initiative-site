import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated half of the launch accessibility pass.
 *
 * This covers what a machine can check reliably: WCAG 2.1 A/AA violations, no horizontal overflow at
 * the supported viewport sizes, and a visible keyboard focus indicator. It cannot judge whether
 * spoken instructions have usable visual equivalents, whether touch targets are reachable for small
 * hands, or whether a Unity canvas is operable — those stay in the manual checklist in
 * docs/accessibility-qa.md, which this suite is meant to shrink rather than replace.
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

test.describe("keyboard access", () => {
  for (const target of PUBLIC_PAGES) {
    test(`${target.name} shows a visible focus indicator on the first control`, async ({ page }) => {
      await page.goto(target.path);
      await page.keyboard.press("Tab");

      const focused = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return null;

        const style = window.getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle,
          boxShadow: style.boxShadow,
        };
      });

      // A page with nothing focusable is legitimate; a page where focus lands invisibly is not,
      // because a keyboard user cannot tell where they are.
      if (!focused) return;

      const hasVisibleIndicator =
        (focused.outlineStyle !== "none" && focused.outlineWidth !== "0px") ||
        (focused.boxShadow !== "none" && focused.boxShadow !== "");
      expect(hasVisibleIndicator, `Focus indicator not visible on <${focused.tag}> at ${target.path}`).toBe(true);
    });
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
