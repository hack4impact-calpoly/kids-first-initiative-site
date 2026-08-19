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
  await expect
    .poll(() => page.frames().some((frame) => frame.url().includes("/game/StatesOfMatter/index.html")), {
      message: "States of Matter iframe should be loaded",
    })
    .toBe(true);
  const unityFrame = page.frames().find((frame) => frame.url().includes("/game/StatesOfMatter/index.html"));

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
  await expect.poll(() => saveBodies.length).toBe(1);

  await expect(page).toHaveURL(/\/statesOfMatterGame\?saveId=existing-save$/);
  expect(saveBodies[0]).toMatchObject({ completedStageIds, classroomParticipantId: null });

  releaseSaves();

  await expect(page).toHaveURL(/\/threeStatesOfMatterQuiz\?saveId=existing-save&phase=after$/);
  await expect.poll(() => quizNavigations).toBe(1);
});

test("keeps the game open and retries when the final States save fails", async ({ page }) => {
  let releaseRetry!: () => void;
  const retryGate = new Promise<void>((resolve) => {
    releaseRetry = resolve;
  });
  const saveBodies: unknown[] = [];

  await page.route("**/api/gameData/existing-save", async (route) => {
    saveBodies.push(route.request().postDataJSON());
    if (saveBodies.length === 1) {
      await route.fulfill({ status: 503, body: "Save unavailable" });
      return;
    }

    await retryGate;
    await jsonResponse(route, { saveId: "existing-save" });
  });

  await page.goto("/statesOfMatterGame?saveId=existing-save");
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();
  await sendCompletion(page);

  await expect(page).toHaveURL(/\/statesOfMatterGame\?saveId=existing-save$/);
  const retryButton = page.getByRole("button", { name: "Try Again" });
  await expect(retryButton).toBeVisible();

  await retryButton.click();

  const savingButton = page.getByRole("button", { name: "Saving..." });
  await expect(savingButton).toBeVisible();
  await expect(savingButton).toBeDisabled();
  await expect(page).toHaveURL(/\/statesOfMatterGame\?saveId=existing-save$/);

  releaseRetry();

  await expect(page).toHaveURL(/\/threeStatesOfMatterQuiz\?saveId=existing-save&phase=after$/);
  expect(saveBodies).toHaveLength(2);
  expect(saveBodies[1]).toMatchObject({ completedStageIds, classroomParticipantId: null });
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

test("replaces a missing personal save before routing to the post-game quiz", async ({ page }) => {
  const patchBodies: unknown[] = [];
  const createBodies: Array<Record<string, unknown>> = [];

  await page.route("**/api/gameData/stale-save", async (route) => {
    patchBodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 404, body: "Save not found" });
  });
  await page.route("**/api/gameData", async (route) => {
    const createBody = route.request().postDataJSON() as Record<string, unknown>;
    createBodies.push(createBody);
    await jsonResponse(route, { saveId: createBody.saveId });
  });

  await page.goto("/statesOfMatterGame?saveId=stale-save");
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();
  await sendCompletion(page);

  await expect.poll(() => createBodies.length).toBe(1);
  const replacementSaveId = String(createBodies[0].saveId);
  await expect(page).toHaveURL(new RegExp(`/threeStatesOfMatterQuiz\\?saveId=${replacementSaveId}&phase=after$`));
  expect(patchBodies).toHaveLength(1);
  expect(createBodies).toHaveLength(1);
  expect(createBodies[0]).toMatchObject({
    gameId: "StatesOfMatter",
    completedStageIds,
    classroomParticipantId: null,
  });
  expect(replacementSaveId).not.toBe("stale-save");
});

test("reuses a new save ID when a completion POST response is lost", async ({ page }) => {
  const createBodies: Array<Record<string, unknown>> = [];
  const recoveryBodies: unknown[] = [];

  await page.route("**/api/gameData", async (route) => {
    createBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    if (createBodies.length === 1) {
      await route.abort("failed");
      return;
    }

    await route.fulfill({ status: 409, body: "Save already exists" });
  });
  await page.route("**/api/gameData/*", async (route) => {
    recoveryBodies.push(route.request().postDataJSON());
    await jsonResponse(route, { saveId: createBodies[0].saveId });
  });

  await page.goto("/statesOfMatterGame");
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();
  await sendCompletion(page);

  await page.getByRole("button", { name: "Try Again" }).click();

  const stableSaveId = String(createBodies[0].saveId);
  await expect(page).toHaveURL(new RegExp(`/threeStatesOfMatterQuiz\\?phase=after&saveId=${stableSaveId}$`));
  expect(createBodies).toHaveLength(2);
  expect(createBodies[1].saveId).toBe(stableSaveId);
  expect(recoveryBodies).toHaveLength(1);
  expect(recoveryBodies[0]).toMatchObject({ completedStageIds, classroomParticipantId: null });
});

test("retries with fresh classroom context after an expired session", async ({ page }) => {
  const classroomSessionKey = "kfi_current_classroom_session";
  const classroomSnapshot = (participantId: string) => ({
    sessionId: "class-session",
    participantId,
    displayName: "Student",
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  const saveBodies: Array<Record<string, unknown>> = [];

  await page.addInitScript(({ key, snapshot }) => window.localStorage.setItem(key, JSON.stringify(snapshot)), {
    key: classroomSessionKey,
    snapshot: classroomSnapshot("expired-participant"),
  });
  await page.route("**/api/gameData", async (route) => {
    saveBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    if (saveBodies.length === 1) {
      await route.fulfill({ status: 403, body: "Class session expired" });
      return;
    }

    await jsonResponse(route, { saveId: saveBodies[1].saveId });
  });

  await page.goto("/statesOfMatterGame");
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();
  await sendCompletion(page);

  await expect(page.getByRole("button", { name: "Rejoin Class" })).toBeVisible();
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), classroomSessionKey)).toBeNull();

  await page.evaluate(({ key, snapshot }) => window.localStorage.setItem(key, JSON.stringify(snapshot)), {
    key: classroomSessionKey,
    snapshot: classroomSnapshot("new-participant"),
  });
  await page.getByRole("button", { name: "Try Again" }).click();

  const stableSaveId = String(saveBodies[0].saveId);
  await expect(page).toHaveURL(new RegExp(`/threeStatesOfMatterQuiz\\?phase=after&saveId=${stableSaveId}$`));
  expect(saveBodies).toHaveLength(2);
  expect(saveBodies[0]).toMatchObject({
    saveId: stableSaveId,
    completedStageIds,
    classroomParticipantId: "expired-participant",
  });
  expect(saveBodies[1]).toMatchObject({
    saveId: stableSaveId,
    completedStageIds,
    classroomParticipantId: "new-participant",
  });
});

test("keeps End Game as a manual post-game quiz fallback", async ({ page }) => {
  await page.goto("/statesOfMatterGame?saveId=manual-save");
  await page.getByRole("link", { name: "End Game" }).click();

  await expect(page).toHaveURL(/\/threeStatesOfMatterQuiz\?saveId=manual-save&phase=after$/);
});
