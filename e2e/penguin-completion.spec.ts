import { expect, test } from "@playwright/test";
import { jsonResponse, prepareGamePage, sendUnityProgress } from "./support/gameBridge";

// Penguin Run reports progress as completed level numbers, where States of Matter reports stage ids.
// That difference is the whole reason this contract needs its own coverage rather than being assumed
// equivalent to the States suite.
const completedLevels = [1, 2, 3];
const classroomSessionKey = "kfi_current_classroom_session";

function sendCompletion(page: import("@playwright/test").Page) {
  return sendUnityProgress(page, "PenguinRun", { completedLevels, gameCompleted: true });
}

test.beforeEach(async ({ page }) => {
  await prepareGamePage(page, "PenguinRun", "/penguinRunQuiz");
});

test("saves final Penguin progress before routing once to the post-game quiz", async ({ page }) => {
  const saveBodies: unknown[] = [];
  let quizNavigations = 0;

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && new URL(frame.url()).pathname === "/penguinRunQuiz") {
      quizNavigations += 1;
    }
  });

  await page.route("**/api/gameData/existing-save", async (route) => {
    saveBodies.push(route.request().postDataJSON());
    await jsonResponse(route, { saveId: "existing-save" });
  });

  await page.goto("/penguinRunGame?saveId=existing-save");
  await expect(page.locator('iframe[title="PenguinRun"]')).toBeVisible();

  await sendCompletion(page);
  await sendCompletion(page);

  await expect(page).toHaveURL(/\/penguinRunQuiz\?saveId=existing-save&phase=after(&participantId=[^&]+)?$/);
  await expect.poll(() => saveBodies.length).toBe(1);
  expect(saveBodies[0]).toMatchObject({ completedLevels, classroomParticipantId: null });

  // A second completion signal must not send the learner through the quiz twice.
  await expect.poll(() => quizNavigations).toBe(1);
});

test("creates a Penguin save and carries its id into the post-game quiz", async ({ page }) => {
  let createBody: Record<string, unknown> | undefined;

  await page.route("**/api/gameData", async (route) => {
    createBody = route.request().postDataJSON() as Record<string, unknown>;
    await jsonResponse(route, { saveId: createBody.saveId });
  });

  await page.goto("/penguinRunGame");
  await expect(page.locator('iframe[title="PenguinRun"]')).toBeVisible();
  await sendCompletion(page);

  await expect.poll(() => Boolean(createBody)).toBe(true);
  await expect(page).toHaveURL(
    new RegExp(`/penguinRunQuiz\\?phase=after&saveId=${String(createBody!.saveId)}(&participantId=[^&]+)?$`),
  );
  expect(createBody).toMatchObject({ gameId: "PenguinRun", completedLevels, classroomParticipantId: null });
});

test("keeps the Penguin game open and retries when the final save fails", async ({ page }) => {
  const saveBodies: unknown[] = [];

  await page.route("**/api/gameData/existing-save", async (route) => {
    saveBodies.push(route.request().postDataJSON());
    if (saveBodies.length === 1) {
      await route.fulfill({ status: 503, body: "Save unavailable" });
      return;
    }
    await jsonResponse(route, { saveId: "existing-save" });
  });

  await page.goto("/penguinRunGame?saveId=existing-save");
  await expect(page.locator('iframe[title="PenguinRun"]')).toBeVisible();
  await sendCompletion(page);

  // A failed save must not strand the learner on a quiz whose result cannot be attributed.
  await expect(page).toHaveURL(/\/penguinRunGame\?saveId=existing-save$/);
  const retryButton = page.getByRole("button", { name: "Try Again" });
  await expect(retryButton).toBeVisible();

  await retryButton.click();

  await expect(page).toHaveURL(/\/penguinRunQuiz\?saveId=existing-save&phase=after(&participantId=[^&]+)?$/);
  expect(saveBodies).toHaveLength(2);
});

test("attributes Penguin progress to the classroom participant and carries it to the quiz", async ({ page }) => {
  const saveBodies: Array<Record<string, unknown>> = [];

  await page.addInitScript(({ key, snapshot }) => window.localStorage.setItem(key, JSON.stringify(snapshot)), {
    key: classroomSessionKey,
    snapshot: {
      sessionId: "class-session",
      participantId: "classroom-participant",
      displayName: "Student",
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
  });

  await page.route("**/api/gameData", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    saveBodies.push(body);
    await jsonResponse(route, { saveId: body.saveId });
  });

  await page.goto("/penguinRunGame");
  await expect(page.locator('iframe[title="PenguinRun"]')).toBeVisible();
  await sendCompletion(page);

  await expect.poll(() => saveBodies.length).toBe(1);
  expect(saveBodies[0]).toMatchObject({
    gameId: "PenguinRun",
    completedLevels,
    classroomParticipantId: "classroom-participant",
  });

  // The quiz renders on the server and cannot read the snapshot, so the participant the save was
  // written under has to travel in the URL or the baseline is read from the wrong record.
  await expect(page).toHaveURL(
    new RegExp(
      `/penguinRunQuiz\\?phase=after&saveId=${String(saveBodies[0].saveId)}&participantId=classroom-participant$`,
    ),
  );
});

test("resumes a Penguin classroom save reported by the server instead of starting over", async ({ page }) => {
  const patchBodies: unknown[] = [];

  await page.route("**/api/gameData/mine**", (route) =>
    jsonResponse(route, {
      saves: [{ saveId: "prior-classroom-save", gameId: "penguinRunGame", lastUpdated: new Date().toISOString() }],
    }),
  );
  await page.route("**/api/gameData/prior-classroom-save", async (route) => {
    patchBodies.push(route.request().postDataJSON());
    await jsonResponse(route, { saveId: "prior-classroom-save" });
  });
  await page.route("**/api/gameData", (route) => route.fulfill({ status: 500, body: "should not create" }));

  await page.addInitScript(({ key, snapshot }) => window.localStorage.setItem(key, JSON.stringify(snapshot)), {
    key: classroomSessionKey,
    snapshot: {
      sessionId: "class-session",
      participantId: "classroom-participant",
      displayName: "Student",
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
  });

  await page.goto("/penguinRunGame");
  await expect(page.locator('iframe[title="PenguinRun"]')).toBeVisible();
  await sendCompletion(page);

  // The prior save is updated rather than a new one created, which is what carries a learner's
  // progress across a page load and across a reopened class.
  await expect.poll(() => patchBodies.length).toBe(1);
  expect(patchBodies[0]).toMatchObject({ completedLevels, classroomParticipantId: "classroom-participant" });
});
