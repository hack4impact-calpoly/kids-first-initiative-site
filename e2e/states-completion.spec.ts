import { expect, test, type Page, type Route } from "@playwright/test";

const completedStageIds = [
  "matter-kitchen/freeze-juice",
  "matter-kitchen/melt-chocolate",
  "matter-kitchen/pour-juice",
  "pipe-rescue/freeze-a-plug",
  "state-lab/ionize-gas",
  "state-lab/melt-wax",
];

const unityShell = `<!doctype html>
<html>
  <body>
    <script>
      window.parent.postMessage({ type: "unity-ready" }, window.location.origin);
    </script>
  </body>
</html>`;

async function prepareGamePage(page: Page) {
  await page.route("**/game/StatesOfMatter/index.html", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: unityShell }),
  );
  await page.route("**/threeStatesOfMatterQuiz**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Post-game quiz</title>" }),
  );
  await page.route("**/api/users/me", (route) => route.fulfill({ status: 401, body: "{}" }));
}

async function sendCompletion(page: Page) {
  const unityFrame = page.frames().find((frame) => frame.url().includes("/game/StatesOfMatter/index.html"));
  expect(unityFrame, "States of Matter iframe should be loaded").toBeDefined();

  await unityFrame!.evaluate((stageIds) => {
    window.parent.postMessage(
      {
        type: "unity-progress",
        payload: { completedStageIds: stageIds, gameCompleted: true },
      },
      window.location.origin,
    );
  }, completedStageIds);
}

function jsonResponse(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.beforeEach(async ({ page }) => {
  await prepareGamePage(page);
});

test("saves final States progress before routing once to the post-game quiz", async ({ page }) => {
  let releaseSaves!: () => void;
  const saveGate = new Promise<void>((resolve) => {
    releaseSaves = resolve;
  });
  const saveBodies: unknown[] = [];
  let quizNavigations = 0;

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && new URL(frame.url()).pathname === "/threeStatesOfMatterQuiz") {
      quizNavigations += 1;
    }
  });

  await page.route("**/api/gameData/existing-save", async (route) => {
    saveBodies.push(route.request().postDataJSON());
    await saveGate;
    await jsonResponse(route, { saveId: "existing-save" });
  });

  await page.goto("/statesOfMatterGame?saveId=existing-save");
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();

  await sendCompletion(page);
  await sendCompletion(page);
  await expect.poll(() => saveBodies.length).toBe(2);

  await expect(page).toHaveURL(/\/statesOfMatterGame\?saveId=existing-save$/);
  expect(saveBodies[0]).toMatchObject({ completedStageIds, classroomParticipantId: null });

  releaseSaves();

  await expect(page).toHaveURL(/\/threeStatesOfMatterQuiz\?saveId=existing-save&phase=after$/);
  await expect.poll(() => quizNavigations).toBe(1);
});

test("adds a newly created save ID to the post-game quiz destination", async ({ page }) => {
  let createBody: unknown;

  await page.route("**/api/gameData", async (route) => {
    createBody = route.request().postDataJSON();
    await jsonResponse(route, { saveId: "created-save" });
  });

  await page.goto("/statesOfMatterGame");
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();
  await sendCompletion(page);

  await expect(page).toHaveURL(/\/threeStatesOfMatterQuiz\?phase=after&saveId=created-save$/);
  expect(createBody).toMatchObject({
    gameId: "StatesOfMatter",
    completedStageIds,
    classroomParticipantId: null,
  });
});

test("keeps End Game as a manual post-game quiz fallback", async ({ page }) => {
  await page.goto("/statesOfMatterGame?saveId=manual-save");
  await page.getByRole("link", { name: "End Game" }).click();

  await expect(page).toHaveURL(/\/threeStatesOfMatterQuiz\?saveId=manual-save&phase=after$/);
});
