import { expect, type Page, type Route } from "@playwright/test";

/**
 * Shared harness for the Unity bridge contract.
 *
 * The real WebGL build is not exercised here: it is replaced by a minimal shell that emits the same
 * postMessage handshake. What is under test is the contract between the game and the site — ready,
 * progress, completion — not Unity itself. Behaviour that needs the real build stays manual QA.
 */
export const unityShell = `<!doctype html>
<html>
  <body>
    <script>
      window.parent.postMessage({ type: "unity-ready" }, window.location.origin);
    </script>
  </body>
</html>`;

export type GameKey = "PenguinRun" | "StatesOfMatter";

export function jsonResponse(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

/** Stubs the Unity build and the quiz destination so a completion can be observed without them. */
export async function prepareGamePage(page: Page, game: GameKey, quizPath: string) {
  await page.route(`**/game/${game}/index.html`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: unityShell }),
  );
  await page.route(`**${quizPath}**`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Post-game quiz</title>" }),
  );
  await page.route("**/api/users/me", (route) => route.fulfill({ status: 401, body: "{}" }));
  // The player asks for its own saves on mount; default to none so each test starts clean.
  await page.route("**/api/gameData/mine**", (route) => jsonResponse(route, { saves: [] }));
}

export async function sendUnityProgress(page: Page, game: GameKey, payload: Record<string, unknown>) {
  const framePath = `/game/${game}/index.html`;

  // Wait for the bridge, not the iframe. The iframe resolves first -- markedly so after a reload,
  // where it comes from cache while the page still has to hydrate -- and postMessage drops a message
  // that arrives before the listener exists, silently and with no error. Waiting on the iframe alone
  // made this helper lose completions on slower runners.
  await expect(page.locator(`iframe[title="${game}"][data-bridge-ready="true"]`)).toBeAttached();

  await expect
    .poll(() => page.frames().some((frame) => frame.url().includes(framePath)), {
      message: `${game} iframe should be loaded`,
    })
    .toBe(true);

  const unityFrame = page.frames().find((frame) => frame.url().includes(framePath));
  await unityFrame!.evaluate((progressPayload) => {
    window.parent.postMessage({ type: "unity-progress", payload: progressPayload }, window.location.origin);
  }, payload);
}
