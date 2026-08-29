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

async function sendUnityProgress(page: Page, payload: Record<string, unknown>) {
  await expect
    .poll(() => page.frames().some((frame) => frame.url().includes("/game/StatesOfMatter/index.html")), {
      message: "States of Matter iframe should be loaded",
    })
    .toBe(true);
  const unityFrame = page.frames().find((frame) => frame.url().includes("/game/StatesOfMatter/index.html"));

  await unityFrame!.evaluate((progressPayload) => {
    window.parent.postMessage(
      {
        type: "unity-progress",
        payload: progressPayload,
      },
      window.location.origin,
    );
  }, payload);
}

function sendCompletion(page: Page) {
  return sendUnityProgress(page, { completedStageIds, gameCompleted: true });
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

  await expect(page).toHaveURL(/\/threeStatesOfMatterQuiz\?saveId=existing-save&phase=after(&participantId=[^&]+)?$/);
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

  await expect(page).toHaveURL(/\/threeStatesOfMatterQuiz\?saveId=existing-save&phase=after(&participantId=[^&]+)?$/);
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

  await expect(page).toHaveURL(/\/threeStatesOfMatterQuiz\?phase=after&saveId=created-save(&participantId=[^&]+)?$/);
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
  await expect(page).toHaveURL(
    new RegExp(`/threeStatesOfMatterQuiz\\?saveId=${replacementSaveId}&phase=after(&participantId=[^&]+)?$`),
  );
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
  await expect(page).toHaveURL(
    new RegExp(`/threeStatesOfMatterQuiz\\?phase=after&saveId=${stableSaveId}(&participantId=[^&]+)?$`),
  );
  expect(createBodies).toHaveLength(2);
  expect(createBodies[1].saveId).toBe(stableSaveId);
  expect(recoveryBodies).toHaveLength(1);
  expect(recoveryBodies[0]).toMatchObject({ completedStageIds, classroomParticipantId: null });
});

test("rotates a lost personal save ID when account ownership changes", async ({ page }) => {
  const createBodies: Array<Record<string, unknown>> = [];
  const recoveryBodies: unknown[] = [];

  await page.route("**/api/gameData", async (route) => {
    const createBody = route.request().postDataJSON() as Record<string, unknown>;
    createBodies.push(createBody);
    if (createBodies.length === 1) {
      await route.abort("failed");
      return;
    }
    if (createBodies.length === 2) {
      await route.fulfill({ status: 409, body: "Save already exists" });
      return;
    }

    await jsonResponse(route, { saveId: createBody.saveId });
  });
  await page.route("**/api/gameData/*", async (route) => {
    recoveryBodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 404, body: "Save not found" });
  });

  await page.goto("/statesOfMatterGame");
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();
  await sendCompletion(page);
  await page.getByRole("button", { name: "Try Again" }).click();

  await expect.poll(() => createBodies.length).toBe(3);
  const originalSaveId = String(createBodies[0].saveId);
  const replacementSaveId = String(createBodies[2].saveId);
  await expect(page).toHaveURL(
    new RegExp(`/threeStatesOfMatterQuiz\\?phase=after&saveId=${replacementSaveId}(&participantId=[^&]+)?$`),
  );
  expect(createBodies).toHaveLength(3);
  expect(createBodies[1].saveId).toBe(originalSaveId);
  expect(replacementSaveId).not.toBe(originalSaveId);
  expect(recoveryBodies).toHaveLength(1);
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

  const expiredParticipantSaveId = String(saveBodies[0].saveId);
  const replacementSaveId = String(saveBodies[1].saveId);
  // The post-quiz renders on the server and cannot read the classroom snapshot, so the participant
  // the save was written under is carried in the URL. It must be the participant that actually
  // received the save, not the expired one, or the quiz would read a baseline from another record.
  await expect(page).toHaveURL(
    new RegExp(`/threeStatesOfMatterQuiz\\?phase=after&saveId=${replacementSaveId}&participantId=new-participant$`),
  );
  expect(saveBodies).toHaveLength(2);
  expect(saveBodies[0]).toMatchObject({
    saveId: expiredParticipantSaveId,
    completedStageIds,
    classroomParticipantId: "expired-participant",
  });
  expect(saveBodies[1]).toMatchObject({
    saveId: replacementSaveId,
    completedStageIds,
    classroomParticipantId: "new-participant",
  });
  expect(replacementSaveId).not.toBe(expiredParticipantSaveId);
});

test("uses a new stable save ID when the classroom participant changes", async ({ page }) => {
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
    snapshot: classroomSnapshot("first-participant"),
  });
  await page.route("**/api/gameData", async (route) => {
    saveBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    if (saveBodies.length === 1) {
      await route.abort("failed");
      return;
    }

    await jsonResponse(route, { saveId: saveBodies[1].saveId });
  });

  await page.goto("/statesOfMatterGame");
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();
  await sendCompletion(page);

  await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
  await page.evaluate(({ key, snapshot }) => window.localStorage.setItem(key, JSON.stringify(snapshot)), {
    key: classroomSessionKey,
    snapshot: classroomSnapshot("second-participant"),
  });
  await page.getByRole("button", { name: "Try Again" }).click();

  const replacementSaveId = String(saveBodies[1].saveId);
  await expect(page).toHaveURL(
    new RegExp(`/threeStatesOfMatterQuiz\\?phase=after&saveId=${replacementSaveId}(&participantId=[^&]+)?$`),
  );
  expect(saveBodies).toHaveLength(2);
  expect(saveBodies[0]).toMatchObject({ classroomParticipantId: "first-participant" });
  expect(saveBodies[1]).toMatchObject({ classroomParticipantId: "second-participant" });
  expect(saveBodies[1].saveId).not.toBe(saveBodies[0].saveId);
});

test("keeps transient classroom save failures separate from expired sessions", async ({ page }) => {
  const classroomSessionKey = "kfi_current_classroom_session";
  const saveBodies: Array<Record<string, unknown>> = [];

  await page.addInitScript((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        sessionId: "class-session",
        participantId: "current-participant",
        displayName: "Student",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    );
  }, classroomSessionKey);
  await page.route("**/api/gameData", async (route) => {
    saveBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    if (saveBodies.length === 1) {
      await route.fulfill({ status: 503, body: "Save unavailable" });
      return;
    }

    await jsonResponse(route, { saveId: saveBodies[1].saveId });
  });

  await page.goto("/statesOfMatterGame");
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();
  await sendCompletion(page);

  await expect(page.getByText("We could not save your game. Check your connection and try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rejoin Class" })).toHaveCount(0);
  await page.getByRole("button", { name: "Try Again" }).click();

  const stableSaveId = String(saveBodies[0].saveId);
  await expect(page).toHaveURL(
    new RegExp(`/threeStatesOfMatterQuiz\\?phase=after&saveId=${stableSaveId}(&participantId=[^&]+)?$`),
  );
  expect(saveBodies).toHaveLength(2);
  expect(saveBodies[1]).toMatchObject({
    saveId: stableSaveId,
    classroomParticipantId: "current-participant",
  });
});

test("requires rejoin instead of falling back to a personal save after classroom context is lost", async ({ page }) => {
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
    const saveBody = route.request().postDataJSON() as Record<string, unknown>;
    saveBodies.push(saveBody);
    if (saveBodies.length === 1) {
      await route.fulfill({ status: 401, body: "Class session expired" });
      return;
    }

    await jsonResponse(route, { saveId: saveBody.saveId });
  });

  await page.goto("/statesOfMatterGame");
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();
  await sendUnityProgress(page, { completedStageIds: [completedStageIds[0]] });
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), classroomSessionKey)).toBeNull();

  await sendCompletion(page);
  await expect(page.getByRole("button", { name: "Rejoin Class" })).toBeVisible();

  await page.evaluate(({ key, snapshot }) => window.localStorage.setItem(key, JSON.stringify(snapshot)), {
    key: classroomSessionKey,
    snapshot: classroomSnapshot("new-participant"),
  });
  await page.getByRole("button", { name: "Try Again" }).click();

  const replacementSaveId = String(saveBodies[1].saveId);
  await expect(page).toHaveURL(
    new RegExp(`/threeStatesOfMatterQuiz\\?phase=after&saveId=${replacementSaveId}(&participantId=[^&]+)?$`),
  );
  expect(saveBodies).toHaveLength(2);
  expect(saveBodies[0]).toMatchObject({ classroomParticipantId: "expired-participant" });
  expect(saveBodies[1]).toMatchObject({
    saveId: replacementSaveId,
    classroomParticipantId: "new-participant",
  });
  expect(saveBodies).not.toContainEqual(expect.objectContaining({ classroomParticipantId: null }));
});

test("keeps expired classroom recovery scoped to its original page load", async ({ page }) => {
  const classroomSessionKey = "kfi_current_classroom_session";
  let saveAttempts = 0;

  await page.addInitScript((key) => {
    if (window.sessionStorage.getItem("kfi_expired_classroom_seeded")) return;

    window.sessionStorage.setItem("kfi_expired_classroom_seeded", "true");
    window.localStorage.setItem(
      key,
      JSON.stringify({
        sessionId: "expired-class-session",
        participantId: "expired-participant",
        displayName: "Student",
        expiresAt: "2000-01-01T00:00:00.000Z",
      }),
    );
  }, classroomSessionKey);
  await page.route("**/api/gameData", async (route) => {
    saveAttempts += 1;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await jsonResponse(route, { saveId: body.saveId });
  });

  await page.goto("/statesOfMatterGame");
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();
  await sendCompletion(page);

  await expect(
    page.getByText("Your class session ended. Ask your teacher to help you rejoin, then try again."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Rejoin Class" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toHaveCount(0);
  expect(saveAttempts).toBe(0);
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), classroomSessionKey)).toBeNull();

  await page.reload();
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();
  await sendCompletion(page);

  await expect(page).toHaveURL(/\/threeStatesOfMatterQuiz\?phase=after&saveId=[^&]+(&participantId=[^&]+)?$/);
  expect(saveAttempts).toBe(1);
});

test("offers sign-in recovery when a personal session expires", async ({ page }) => {
  await page.route("**/api/gameData", (route) => route.fulfill({ status: 401, body: "Sign-in required" }));

  await page.goto("/statesOfMatterGame");
  await expect(page.locator('iframe[title="StatesOfMatter"]')).toBeVisible();
  await sendCompletion(page);

  await expect(page.getByText("Your sign-in ended. Sign in again, then try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rejoin Class" })).toHaveCount(0);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Sign In" }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/login\/player\/sign-in$/);
  await popup.close();
});

test("keeps End Game as a manual post-game quiz fallback", async ({ page }) => {
  await page.goto("/statesOfMatterGame?saveId=manual-save");
  await page.getByRole("link", { name: "End Game" }).click();

  await expect(page).toHaveURL(/\/threeStatesOfMatterQuiz\?saveId=manual-save&phase=after(&participantId=[^&]+)?$/);
});
