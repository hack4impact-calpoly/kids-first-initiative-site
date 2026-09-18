import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Keep the repaired sign-in contrast in the required browser suite; the wider accessibility
// audit remains a separate report and does not prove real-device or Unity accessibility.
for (const path of ["/login/player", "/login/facilitator"]) {
  test(`sign-in text meets contrast requirements on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  });
}
