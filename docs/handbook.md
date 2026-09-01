# Kids First Initiative — Project Handbook

Kids First Initiative is a web platform that teaches STEM to children in underserved communities.
Children play one of two Unity WebGL games and answer a short quiz before and after each one, so that
what they learned can be measured.

This handbook is the plain-text companion to [index.html](./index.html), which presents the same
material formatted for reading.

- **Repository:** `hack4impact-calpoly/kids-first-initiative-site`
- **Stack:** Next.js 16.3.3 (App Router), React 18, Mongoose 8, Clerk, Chakra UI 3
- **Hosting:** Vercel
- **Integration branch:** `develop`, which is currently also the production branch
- **Last updated:** 31 August 2026

## Contents

1. [Overview](#overview)
2. [Getting started](#getting-started)
3. [Architecture](#architecture)
4. [Classroom sessions](#classroom-sessions)
5. [API](#api)
6. [Testing](#testing)
7. [Releases](#releases)
8. [Operations](#operations)
9. [Outstanding work](#outstanding-work)
10. [Further reading](#further-reading)

---

## Overview

Each game is bracketed by a quiz. A child answers the pre-quiz, plays, then answers the post-quiz.
The difference between the two scores is the outcome the organisation reports, so every result must
be attributable to a particular child in a particular class. Progress saves continuously during play,
which means a dropped connection or a closed tab does not lose a child's work.

### Games

| Game             | Teaches                                      | Reports progress as     | Build location                |
| ---------------- | -------------------------------------------- | ----------------------- | ----------------------------- |
| States of Matter | Melting, freezing, condensing                | Completed stage ids     | `public/game/StatesOfMatter/` |
| Penguin Run      | Gravity and friction, through track building | Completed level numbers | `public/game/PenguinRun/`     |

The two games report progress in different formats, so each has its own browser-test coverage.

### Roles

| Role                | Capabilities                                                            | Identified by                                                      |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Learner (classroom) | Joins with a class code, plays, answers both quizzes                    | HTTP-only cookie tied to a participant record                      |
| Learner (personal)  | Signs in and plays independently                                        | Clerk account                                                      |
| Educator            | Opens a class, shares the code, monitors progress, reopens past classes | Clerk account with the educator role, linked to a `Teacher` record |
| Administrator       | Cross-class analytics and learning outcomes                             | Clerk account with the admin role                                  |

Classroom learners do not have accounts. The audience is young children on shared school hardware,
where account creation is both a barrier to starting a lesson and a larger collection of personal
data than the platform needs.

---

## Getting started

### Prerequisites

- Node.js 20 or 22. CI tests both.
- A MongoDB connection string.
- Clerk API keys. Ask a tech lead.

### Setup

```sh
npm install
npm run dev
```

Create a `.env` file in the repository root with three values, obtained from a tech lead:

```
MONGO_URI=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

There is no `.env.example` in the repository; the list above is the current requirement.

Install the Prettier and ESLint editor extensions and enable format on save. A Husky hook formats
staged files on commit.

### Commands

| Command                                 | Purpose                                       |
| --------------------------------------- | --------------------------------------------- |
| `npm run dev`                           | Development server                            |
| `npm test`                              | Unit tests                                    |
| `npm run test:e2e`                      | Browser tests. Requires MongoDB               |
| `npm run test:a11y`                     | Accessibility report                          |
| `npm run lint`, `npm run lint:fix`      | ESLint                                        |
| `npm run format`                        | Prettier                                      |
| `npm audit`                             | Dependency vulnerabilities                    |
| `node scripts/validate-webgl-build.mjs` | Verify both embedded game builds are complete |

### Contributing

Branch from `develop`. Run `npm run lint` and `npm test` before opening a pull request against
`develop`. Do not branch from `main`; see [Releases](#releases) for why it may not exist yet.

### Environment notes

Several local failures have environmental causes:

- **`next build` fails at prerender without Clerk keys.** Compilation and type checking have already
  run by that point. To build locally with placeholder keys:

  ```sh
  PK="pk_test_$(printf 'example.clerk.accounts.dev$' | base64 | tr -d '\n')"
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$PK" \
    CLERK_SECRET_KEY="sk_test_0000000000000000000000000000000000000000" \
    npm run build
  ```

- **`npx tsc --noEmit` reports pre-existing errors** in `e2e/` and `.next/`. Filter with
  `grep -E '^src/'` to see whether your change is clean.
- **Run `npm install` after switching branches.** Dependencies have moved substantially.
- **The browser suite requires MongoDB**, which is not available in every environment. CI is the
  authoritative check for both the build and the browser tests.

---

## Architecture

| Area                  | Responsibility                                                                                                       | Location                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Authorization         | API handlers are the security boundary. Ownership is derived server-side, never from a client-supplied id            | `src/lib/server/apiAuthorization.ts`, `classroomAuthorization.ts` |
| Classroom history     | Groups sessions into classes, merges rosters across reopens, computes metrics. Pure functions with no database calls | `src/lib/server/classroomHistory.ts`                              |
| Classroom data access | Loads class chains and class detail; performs reopening                                                              | `src/lib/server/classroomClasses.ts`                              |
| Unity bridge          | Receives progress from the game over `postMessage`, saves it, and routes to the post-quiz once                       | `src/components/GamePlayer.tsx`, `UnityIFrame.tsx`                |
| Quiz progress         | Reads the baseline score recorded before play                                                                        | `src/lib/server/quizProgress.ts`                                  |
| Admin analytics       | Aggregates outcomes across classes and reports the scope each figure covers                                          | `src/lib/server/adminAnalytics.ts`                                |
| Observability         | Structured error reports carrying a correlation id and release SHA                                                   | `src/lib/server/observability.ts`                                 |
| Quiz scoring          | Score normalisation shared by the dashboards and class history                                                       | `src/lib/quizScoring.ts`                                          |

The repository contains 23 pages under the App Router and 10 Mongoose schemas in `src/database/`.

Hidden links and disabled buttons are user-interface conveniences and carry no security weight. All
access decisions are enforced in the API handler.

---

## Classroom sessions

Read this section before changing anything that touches a class. Most of the subtle bugs in this
project have come from misreading the model below.

A class is a chain of sessions, not a single record. When an educator reopens a closed class, the
system appends a new session linked to the previous one; it does not reactivate the old session.
Historical records continue to reference the sessions that produced them, so nothing is rewritten or
re-attributed.

| Field                    | Meaning                                                      | Consequence                                                                                                      |
| ------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `rootSessionId`          | Head of the continuation chain; null on an original session  | A class is addressed by `rootSessionId ?? _id`                                                                   |
| `continuedFromId`        | The session this one continues                               | Determines chain order                                                                                           |
| `participantKey`         | Stable per learner per class: `clerk:<id>` or `guest:<hash>` | A returning learner collapses to a single roster entry. It embeds a Clerk id, so it must not be sent to a client |
| `status` and `expiresAt` | Session state is derived, never stored                       | `closed` means closed; `active` with a past expiry means expired. Use `resolveClassroomSessionState`             |
| `participant:<id>`       | Owner key on a classroom learner's saves and quiz records    | Changes when a learner rejoins after a reopen; lineage resolution carries their progress across                  |

### Constraints and lifetime

A unique partial index permits at most one active continuation per class, which prevents two
simultaneous reopens from leaving a class with two working access codes. The index builds in the
background, and a failure logs `ClassroomSession index build failed`. If a class appears to have two
live sessions, check the index first.

Classroom sessions expire after 8 hours. An educator reporting that a code has stopped working has
usually hit the expiry rather than an outage; they can reopen the class from Class History, which
issues a new code and retires all previous ones.

---

## API

33 endpoints across 22 route files. Two conventions apply throughout: identity is derived on the
server, and a resource the caller cannot access returns `404` rather than `403`, so its existence
cannot be probed.

| Route                                             | Methods        | Access                                                            |
| ------------------------------------------------- | -------------- | ----------------------------------------------------------------- |
| `/api/health`                                     | GET            | Public. Deployment health only, no learner data                   |
| `/api/classroom-sessions`                         | GET POST PATCH | Signed-in educator, scoped to their own classes                   |
| `/api/classroom-sessions/join`                    | POST           | Public with an active code. Issues a classroom credential         |
| `/api/classroom-sessions/history`                 | GET            | Educator, own classes only                                        |
| `/api/classroom-sessions/history/:classId`        | GET            | Owning educator or administrator                                  |
| `/api/classroom-sessions/history/:classId/reopen` | POST           | Owning educator only. No administrator bypass                     |
| `/api/gameData`                                   | GET POST       | GET administrator; POST owner or credentialed participant         |
| `/api/gameData/mine`                              | GET            | The caller's own saves, including classroom lineage               |
| `/api/gameData/:saveId`                           | GET PATCH      | Owner, administrator, or the educator who owns the classroom      |
| `/api/quiz`, `/api/quiz/:id`                      | GET POST PUT   | Owner or administrator; educators may read within their classroom |
| `/api/admin/analytics`                            | GET            | Administrator                                                     |
| `/api/admin/:id/role`                             | PATCH          | Administrator                                                     |
| `/api/auth/admin-access`                          | GET            | Administrator                                                     |
| `/api/users`, `/api/users/:id`                    | GET POST PUT   | Administrator                                                     |
| `/api/users/me`, `/api/users/me/photo`            | GET PATCH      | Signed-in user, own record                                        |
| `/api/sessions`, `/api/sessions/:sessionId`       | GET POST PATCH | Owner or administrator                                            |
| `/api/events`                                     | GET POST       | GET administrator; POST owner or credentialed participant         |

Stored records contain Clerk ids, quiz ids, and per-question answers, and `participantKey` embeds a
Clerk id. History and analytics endpoints return projected views that never select these fields.

Full policy: [api-authorization.md](./api-authorization.md).

---

## Testing

| Layer                       | Command             | Covers                                                                           | Does not cover                                                                   |
| --------------------------- | ------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Unit (128 tests, 15 files)  | `npm test`          | Authorization decisions, classroom chain logic, scoring, analytics               | The real database; MongoDB is mocked throughout                                  |
| Browser (18 tests, 2 files) | `npm run test:e2e`  | Both games' completion contracts, save creation and retry, classroom attribution | Authorization, pending a test-only auth stub (issue #69)                         |
| Accessibility (26 checks)   | `npm run test:a11y` | WCAG 2.1 AA via axe, horizontal overflow at device sizes, reduced motion         | Audio-only instructions, touch target reach, operability of the games themselves |

Unit tests mock MongoDB, so they cover authorization and business logic but not database wiring.
Connection ordering, index behaviour, and query shape are unverified at that layer. A recent
high-severity bug, in which a query was issued before the connection was opened and hung for ten
seconds before failing, was invisible to the whole unit suite and was found by reading the call
graph.

The accessibility suite reports; it does not gate merges. Known violations remain, so a green
pipeline does not mean a clean report. The Playwright report is uploaded on every CI run; read it.
Keyboard focus visibility is checked by hand, because the automated version was timing-dependent and
was removed.

Both browser suites share one harness in `e2e/support/gameBridge.ts`. Do not add a local copy. The
States suite kept its own until August 2026; the two drifted, and the stale copy left that suite
dependent on a live database, where it failed 11 of its 13 tests.

CI runs on Node 20 and 22.

---

## Releases

`develop` is currently the production branch. Vercel deploys from it, so every merged pull request
goes live immediately. There is no staging environment and no separate release step. Treat every
merge as a production change until the switch below has been made.

The replacement is already built. `main` holds what is live, `develop` remains the integration
branch, and the `promote-to-production` workflow fast-forwards `main` to a chosen commit. It refuses
any commit that is not already an ancestor of `develop` and does not have a passing CI run for that
exact SHA.

Once `main` is the production branch, reverting a commit on `develop` no longer changes what is live.
The revert must also be promoted.

### Unity builds

Game builds are committed to `public/game/<Game>/`. The `build-unity-webgl` workflow builds a game
from its source repository and opens a pull request containing only that game's directory. The
promotion job validates the artifact and builds the site against it before opening the pull request,
because a pull request opened with the default `GITHUB_TOKEN` does not trigger `on: pull_request`
workflows and would otherwise arrive with no checks.

The workflow's `source_ref` input accepts a branch, tag, or commit SHA.

Full detail: [releases.md](./releases.md).

---

## Operations

`GET /api/health` distinguishes a database problem from a broken game build in a single request. It
carries no learner data and returns `503` on failure, so an uptime monitor can alert on it without
parsing the body.

```sh
curl -s https://<site>/api/health | jq
```

| Field      | Reports                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `database` | Connection state. `degraded` means queries would buffer and time out, which presents as a hang rather than an error    |
| `games`    | Per game: whether the required files are present, and the Unity source SHA currently live. Makes a rollback verifiable |
| `release`  | The deployed commit, so an alert identifies which version is affected                                                  |

Errors are reported through `reportError` as single-line JSON with a correlation id, environment, and
release. Its context parameter accepts only primitives, so a quiz answer, a child's name, or a
request body cannot be attached by accident. Scopes such as `unity-boot` and `progress-save` stay
distinguishable so alerts can separate them. `setErrorSink` is the integration point for a hosted
tracker.

During a live class, roll back rather than fix forward. An educator with a room of children waiting
cannot absorb a fix-and-deploy cycle, and Vercel's instant rollback takes effect without a git
operation.

Full runbook: [operations.md](./operations.md).

---

## Outstanding work

### Before launch

Five items remain. None are blocked on code; each needs dashboard access, hardware, or a decision.

**1. Run the MongoDB restore drill.** Children's learning records are stored without a verified means
of recovering them.

- Restore from Atlas → Backup → Restore, targeting a new cluster rather than production.
- Run `MONGO_URI=<restored-uri> npm run dev`.
- Confirm an educator can open a class and see its roster and quiz results. Checking only that the
  cluster starts does not exercise the data.
- Delete the temporary cluster, and record the date and who ran the drill.

_Requires MongoDB Atlas access. About 1 hour. Detail in operations.md._

**2. Point Vercel's production branch at `main`.** This enables the release gate. All three steps
belong together, because a `main` branch that exists while Vercel still deploys `develop` looks
authoritative and goes stale immediately.

```sh
git fetch origin
git branch main origin/develop
git push origin main
```

- Protect both branches under Settings → Branches.
- Set Vercel → Project → Settings → Git → Production Branch to `main`.
- Promote once and confirm with `curl -s https://<site>/api/health | jq .release`.

_Requires Vercel and repository settings access. About 15 minutes. Detail in releases.md._

**3. Run the device QA pass.** The largest remaining item, and the only one that produces further
work in the form of a defect list.

- Run the full loop for both games twice: once signed in, once as a classroom participant. These
  resolve ownership differently and have broken independently.
- Play with sound off. Both games are audio-heavy, and any instruction delivered only as audio will
  be missed.
- Confirm the on-screen guides in Penguin Run render. They have been through three rounds of fixes
  and have never been visually verified.

_Requires a physical Chromebook and iPad with sound. About 1 week plus a fix tail. Detail in
accessibility-qa.md._

**4. Assign an owner to each alert.** Every alert in the runbook needs a named person. The team that
built the project is graduating, so alerts left unassigned will have no default recipient.

_No access required. About 30 minutes. Detail in operations.md._

**5. Choose an error-tracking vendor.** `setErrorSink` is the integration point. The choice has been
deferred because it carries a recurring cost and a data-processing agreement for a product used by
children. Confirm the vendor does not capture request bodies or session replay by default; the
reporting layer deliberately excludes answers and names, and session replay would reintroduce them.

_Requires budget approval. About 2 hours once chosen._

### Status by area

| Area                                   | Status                  | Remaining                                                       |
| -------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| Learning loop, both games              | Shipped                 | Verification on real devices                                    |
| Classroom sessions, reopening, history | Shipped                 | —                                                               |
| Admin analytics                        | Shipped                 | —                                                               |
| Dependency security                    | 0 known vulnerabilities | Six pre-existing React hook warnings need a browser to diagnose |
| Unity build and promotion (#48)        | Shipped                 | —                                                               |
| Observability and health checks (#49)  | Needs a person          | Restore drill, alert owners, vendor choice                      |
| Accessibility and device QA (#50)      | Needs a person          | The manual pass                                                 |
| End-to-end coverage (#47)              | Open                    | Deterministic database fixtures, per-test seeding               |
| Browser authorization tests (#69)      | Open                    | A test-only auth stub, not a middleware change                  |

---

## Further reading

| Document                                             | Covers                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [operations.md](./operations.md)                     | On-call runbook: health checks, alert thresholds, rollback, restore drill, incident triage |
| [releases.md](./releases.md)                         | Branch topology, the migration to `main`, promotion workflow guarantees                    |
| [accessibility-qa.md](./accessibility-qa.md)         | Device matrix, the manual launch pass, and the limits of the automation                    |
| [api-authorization.md](./api-authorization.md)       | Route inventory, principals, response conventions                                          |
| [game-progress-bridge.md](./game-progress-bridge.md) | The contract Unity builds use to report progress                                           |
| [index.html](./index.html)                           | This handbook, formatted for reading and sharing                                           |
