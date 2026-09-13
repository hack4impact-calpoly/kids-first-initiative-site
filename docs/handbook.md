# Developer handbook

Kids First Initiative combines two Unity games with before/after quizzes and classroom dashboards.
Start with the [partner guide](partner-guide.md) for the teaching workflow and
[handoff checklist](handoff.md) for access, ownership, and unresolved work.

Reviewed 5 September 2026 against website commit `3258a3f`. Dependencies and commands are defined
in [package.json](../package.json); deployed settings must be checked in the service dashboards.

## Run the website locally

You need Git, Node.js 24 (CI also runs 22), a development MongoDB database, and keys for a Clerk
development application. Unity is only needed when editing a game.

```sh
git clone https://github.com/hack4impact-calpoly/kids-first-initiative-site.git
cd kids-first-initiative-site
git switch develop
npm ci
cp .env.example .env.local
```

Fill in `.env.local` before starting the server. Obtain credentials from the service owners in
the [handoff checklist](handoff.md); use a development database with synthetic learners.

| Variable                            | Value / source                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `MONGO_URI`                         | Development database URI; allow your network in Atlas and confirm the database user has access |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Publishable key from the same Clerk application as the secret key                              |
| `CLERK_SECRET_KEY`                  | Clerk secret key; keep out of Git and client code                                              |

```sh
npm run dev
```

Open `http://localhost:3000`. A successful homepage is only the first check: create an educator
account, start a class, join from a separate browser profile, finish one game and both quizzes,
and check the educator's results. Repeat for the second game before changing the learning flow.

### Accounts and roles

Use `/sign-up/facilitator` for educator/parent registration and `/sign-up/player` for a personal
player. Classroom learners use `/login/player` with a name and class code; no personal account is required.

The application expects a top-level Clerk session claim named `role`. Configure the development
application's session token with `{"role":"{{user.public_metadata.role}}"}` using
[Clerk's session-token settings](https://clerk.com/docs/guides/sessions/customize-session-tokens).
Registration writes the role to Clerk public metadata and the MongoDB `User` record. A `Teacher`
record is created when an educator first creates a class. API admin checks read the session claim;
educator checks also read MongoDB, so changing only one copy can leave access inconsistent.

Ask an existing admin to grant admin access. For the first admin in a new environment, the Clerk
application owner must set that account's public metadata role to `admin`, then complete the app's
user registration/synchronization. Sign out and back in after role changes to refresh claims.
Verify `/api/users/me` and `/adminDashboard`; a new account is not automatically an administrator.

For Vercel production keys and `/__clerk` proxy activation, follow the
[release checklist](releases.md#activate-clerk-production-on-vercel). Clerk SDK 7 is installed;
the custom facilitator/admin forms intentionally use `@clerk/nextjs/legacy` hooks to preserve
their existing sign-in and verification flows during the upgrade.

## How the parts connect

```text
Learner browser
  ├─ Next.js pages → API handlers → MongoDB (classes, saves, quizzes)
  ├─ Clerk session or classroom cookie → server authorization
  └─ Embedded Unity game → progress message → save → post-quiz
```

The website uses Next.js App Router, React, TypeScript, Chakra UI, Clerk, and Mongoose. Vercel serves
the website and the compiled games. Unity source lives in separate repositories; changing it does
not update the website until a new WebGL build is promoted.

| Change                                | Start here                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pages and navigation                  | [`src/app/`](../src/app/), [`src/components/`](../src/components/)                                                                                                                         |
| Quiz questions / scoring              | [`src/data/quiz.json`](../src/data/quiz.json), [`quizScoring.ts`](../src/lib/quizScoring.ts)                                                                                               |
| Game integration / completion retries | [`GamePlayer.tsx`](../src/components/GamePlayer.tsx), [`UnityIFrame.tsx`](../src/components/UnityIFrame.tsx)                                                                               |
| API access rules                      | [`api-authorization.md`](api-authorization.md), [`src/lib/server/`](../src/lib/server/)                                                                                                    |
| Classroom reopening / history         | [`classroomClasses.ts`](../src/lib/server/classroomClasses.ts), [`classroomHistory.ts`](../src/lib/server/classroomHistory.ts)                                                             |
| Stored records                        | [`src/database/`](../src/database/)                                                                                                                                                        |
| Dashboard aggregates                  | [`adminAnalytics.ts`](../src/lib/server/adminAnalytics.ts)                                                                                                                                 |
| Deployment / game builds              | [Release guide](releases.md), [`.github/workflows/`](../.github/workflows/)                                                                                                                |
| Unity gameplay                        | [States of Matter](https://github.com/hack4impact-calpoly/kids-first-initiative-states-of-matter), [Penguin Run](https://github.com/hack4impact-calpoly/kids-first-initiative-penguin-run) |

### Data rules to preserve

- Authorize every API request on the server. Hiding a link does not protect its data. Personal
  records use a Clerk ID; classroom records use `participant:<id>` plus a validated classroom cookie.
- A class is a chain of sessions. Reopening appends a session; its class ID is `rootSessionId ?? _id`.
  Keep historical records attached to their original session. Sessions last eight hours, and starting
  another class closes the educator's previous active sessions.
- `participantKey` joins records across a class chain. The server resolves earlier saves only for
  that identity and class. Guest rejoining currently creates a fresh token after a successful join,
  so a matching display name alone does not recover earlier progress.
- Stored `status` and `expiresAt` determine effective session state; use `resolveClassroomSessionState`.
  A unique partial index prevents duplicate active continuations. Unit tests do not verify that index.
- Keep stage IDs and level numbers stable. Progress snapshots are merged with stored completions;
  only `gameCompleted: true` initiates the post-quiz, after the save succeeds. See the
  [bridge contract](game-progress-bridge.md).
- Quiz scores store counts; negative values mean unattempted. Question-count changes alter how old
  scores are normalized. Treat curriculum/scoring changes as a data compatibility decision.

## Verify a change

```sh
npm run lint
npm test
npm run build
node scripts/validate-webgl-build.mjs
npx playwright install chromium
npm run test:e2e
```

| Check                                     | What it establishes                                       | What it leaves untested                                                                            |
| ----------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Unit tests                                | Authorization helpers, scoring, class logic               | Real MongoDB queries, indexes, and migrations                                                      |
| Browser tests                             | Website completion, attribution, and save-retry contracts | Real Unity, database persistence, and Clerk authorization; those dependencies are stubbed/bypassed |
| WebGL validator / site build              | Required artifact files and site compilation              | Actual gameplay, audio, rendering, and touch controls                                              |
| `npm run test:a11y`                       | Automated accessibility findings on public pages          | Full accessibility; findings currently do not block CI                                             |
| [Manual device pass](accessibility-qa.md) | Real games, real accounts, input, audio, and results      | Only the devices and cases actually recorded                                                       |

Playwright forces placeholder credentials and starts its own server at `127.0.0.1:3100`; the
current bridge tests do not need a running MongoDB or Clerk service. Stop any unrelated server on
that port before testing. Never enable `KFI_E2E_BYPASS_CLERK` for normal development or deployment.

CI builds and runs unit tests on Node 22 and 24, and browser/accessibility checks on Node 24.
Both web CI and the Unity artifact's site-build check use dummy Clerk keys and a loopback MongoDB
URI. No real MongoDB or Clerk credentials, account, or running database are needed for these checks.
Future real-service integration tests need a separate, isolated test environment—not Production
or Preview learner data. These dummy settings are not deployment configuration.
It does not run ESLint. Run lint locally and inspect the uploaded Playwright report even when CI
is green. `npm run format` formats the whole repository; use Prettier on changed files when working
in an existing checkout. Husky formats staged files on commit.

## Contribute and troubleshoot

Branch from `develop` and open pull requests against it. Include the behavior changed, verification,
and any data or deployment implications. **Merges to `develop` currently deploy production**;
coordinate classroom-impacting releases with the partner. See [releases.md](releases.md).

| Symptom                                  | First check                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Local build fails on Clerk configuration | Both keys are set, from the same development app; placeholders do not validate real sign-in     |
| Database calls hang                      | `MONGO_URI`, Atlas network access, database credentials, and `await connectDB()` before queries |
| Signed in but wrong dashboard / `403`    | Clerk session claim and MongoDB role; refresh the session after a role change                   |
| Class code rejected                      | Expiry or a newer class; reopen the intended class and share its new code                       |
| Game is blank                            | Browser console/network, complete build files, then the real device pass                        |
| Health monitor reports `401`             | Known proxy restriction; see [operations.md](operations.md), not evidence of database failure   |

Record new gaps in the owning repository's issues. Keep [handoff.md](handoff.md) current with
decisions and evidence; keep incident procedures in [operations.md](operations.md).
