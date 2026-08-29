# KFI Project Handbook

Plain-text companion to [index.html](./index.html). Same content, structured for search, grep, and AI
assistants. Updated 29 August 2026.

**Project:** Kids First Initiative — a web platform teaching STEM to children in underserved
communities through two Unity WebGL games, bracketed by a pre-quiz and post-quiz so learning can be
measured.
**Repository:** `hack4impact-calpoly/kids-first-initiative-site`
**Integration branch:** `develop` (which is also currently the production branch)
**Stack:** Next.js 16.3.3, React 18, MongoDB via Mongoose 8, Clerk auth, Chakra UI 3, Vercel hosting

---

## At a glance

Counted from the repository. Each number carries its limitation, because a metric without one
invites more confidence than it has earned.

| Metric                | Value                    | Caveat                                                                                       |
| --------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| Unit tests            | 128 across 15 files      | All mock MongoDB — connection ordering, index behaviour, and query shape are unverified here |
| Browser tests         | 18 across 2 files        | The only layer exercising real wiring; cannot yet cover authorization                        |
| Accessibility checks  | 26                       | Reports, does not gate — real violations remain; read the CI artifact                        |
| API endpoints         | 33 across 22 route files | Identity always derived server-side                                                          |
| Known vulnerabilities | 0                        | Down from 53, including a Clerk middleware auth bypass                                       |
| Blocked on a person   | 6                        | Access or hardware, not code                                                                 |
| Pages                 | 23                       | App Router                                                                                   |
| Mongoose models       | 10                       |                                                                                              |
| CI workflows          | 3                        | `ci`, `build-unity-webgl`, `promote-to-production`                                           |

---

## What the product does

The product exists to **prove learning happened**, not just to entertain. That single goal explains
most of its design: every game is bracketed by a quiz, and every result is attributable to a specific
child in a specific class.

**The learning loop:** pre-quiz → game → post-quiz. The difference between the two quizzes is the
number the organisation cares about. Progress saves continuously during play, so a lost connection or
closed tab does not cost a child their work.

### Games

| Game             | Teaches                                 | Progress format                         | Location                      |
| ---------------- | --------------------------------------- | --------------------------------------- | ----------------------------- |
| States of Matter | Melting, freezing, condensing           | Completed **stage ids** (named puzzles) | `public/game/StatesOfMatter/` |
| Penguin Run      | Gravity and friction via track building | Completed **level numbers**             | `public/game/PenguinRun/`     |

The two report progress differently, which is why each needs its own browser-test coverage rather
than assuming equivalence.

### Roles

| Role                | What they do                                                         | Identified by                                                        |
| ------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Learner (classroom) | Joins with a class code, plays, takes both quizzes                   | HTTP-only cookie tied to a participant record; **no account needed** |
| Learner (personal)  | Signs in and plays independently                                     | Clerk account                                                        |
| Educator            | Opens a class, shares a code, watches progress, reopens past classes | Clerk account with educator role, linked to a `Teacher` record       |
| Administrator       | Cross-class analytics and learning outcomes                          | Clerk account with admin role                                        |

**Why classroom learners have no accounts:** the audience is young children on shared school
hardware. Requiring accounts would be a barrier and would collect far more personal data than the
product needs.

---

## Components

| Component             | Responsibility                                                                                                                                       | Location                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Authorization layer   | API handlers are the security boundary — not page visibility, never a client-supplied id. Ownership derived server-side.                             | `src/lib/server/apiAuthorization.ts`, `classroomAuthorization.ts` |
| Classroom history     | Pure functions grouping sessions into classes, merging rosters across reopens, computing metrics. No database calls, so it is testable in isolation. | `src/lib/server/classroomHistory.ts`                              |
| Classroom data access | Loads class chains, class detail, and performs reopening                                                                                             | `src/lib/server/classroomClasses.ts`                              |
| Unity bridge          | Games post progress over `postMessage`; the site saves it and routes to the post-quiz exactly once                                                   | `src/components/GamePlayer.tsx`, `UnityIFrame.tsx`                |
| Quiz progress         | Reads the baseline recorded before playing. Read and write paths must agree on which record belongs to the learner.                                  | `src/lib/server/quizProgress.ts`                                  |
| Admin analytics       | Aggregates outcomes across classes, states which sessions each number covers, counts classroom learners without accounts                             | `src/lib/server/adminAnalytics.ts`                                |
| Observability         | Structured error reports with correlation id and release SHA; context accepts only primitives                                                        | `src/lib/server/observability.ts`                                 |
| Quiz scoring          | Score normalisation shared by dashboards and history                                                                                                 | `src/lib/quizScoring.ts`                                          |

---

## The classroom data model

**The single most important concept.** Almost every bug in this area has come from misunderstanding
it.

**A class is not a session — it is a chain of them.** When an educator reopens a closed class, the
system does not revive the old session. It appends a new one linked back through `rootSessionId`.
Historical records keep pointing at the sessions that produced them; nothing is rewritten or
re-attributed.

| Concept                | Meaning                                                       | Consequence                                                                                                 |
| ---------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `rootSessionId`        | Head of the continuation chain; null on an original session   | A class is addressed by `rootSessionId ?? _id`                                                              |
| `continuedFromId`      | The session this one continues                                | Chain ordering                                                                                              |
| `participantKey`       | Stable per learner per class — `clerk:<id>` or `guest:<hash>` | A returning learner is one roster entry, not two. **Never send to a client** — it embeds a Clerk id         |
| `status` + `expiresAt` | Session state is **derived, never stored**                    | `closed` means closed; `active` with a past expiry means expired. Always use `resolveClassroomSessionState` |
| `participant:<id>`     | Owner key on a classroom learner's saves and quiz records     | Changes when they rejoin after a reopen; lineage resolution carries progress across                         |

**Database-enforced invariant:** a unique partial index guarantees at most one active continuation
per class, preventing two simultaneous reopens from leaving a class with two working access codes. It
builds in the background; failure logs `ClassroomSession index build failed`. If a class shows two
live sessions, check that index first.

**Session lifetime:** classroom sessions expire after 8 hours. An educator reporting "the code
stopped working" is usually an expiry, not an outage — they can reopen from Class History, which
issues a new code and retires every previous one.

---

## API surface

33 endpoints across 22 route files. Two conventions run throughout: **identity is derived on the
server**, and an inaccessible resource answers `404` rather than `403` so it cannot be probed for.

| Route                                             | Methods        | Access                                                |
| ------------------------------------------------- | -------------- | ----------------------------------------------------- |
| `/api/health`                                     | GET            | Public — deployment health only, no learner data      |
| `/api/classroom-sessions`                         | GET POST PATCH | Signed-in educator, scoped to own classes             |
| `/api/classroom-sessions/join`                    | POST           | Public with active code; issues classroom credential  |
| `/api/classroom-sessions/history`                 | GET            | Educator, own classes only                            |
| `/api/classroom-sessions/history/:classId`        | GET            | Owning educator or administrator                      |
| `/api/classroom-sessions/history/:classId/reopen` | POST           | Owning educator only — **no admin bypass**            |
| `/api/gameData`                                   | GET POST       | GET admin; POST owner or credentialed participant     |
| `/api/gameData/mine`                              | GET            | Caller's own saves, including classroom lineage       |
| `/api/gameData/:saveId`                           | GET PATCH      | Owner, admin, or educator owning the classroom        |
| `/api/quiz`, `/api/quiz/:id`                      | GET POST PUT   | Owner or admin; educators read within their classroom |
| `/api/admin/analytics`                            | GET            | Administrator                                         |
| `/api/admin/:id/role`                             | PATCH          | Administrator                                         |
| `/api/auth/admin-access`                          | GET            | Administrator                                         |
| `/api/users`, `/api/users/:id`                    | GET POST PUT   | Administrator                                         |
| `/api/users/me`, `/api/users/me/photo`            | GET PATCH      | Signed-in user, own record                            |
| `/api/sessions`, `/api/sessions/:sessionId`       | GET POST PATCH | Owner or administrator                                |
| `/api/events`                                     | GET POST       | GET admin; POST owner or credentialed participant     |

**What never crosses the boundary:** stored records contain Clerk ids, quiz ids, and per-question
answers, and `participantKey` embeds a Clerk id. History and analytics responses are projected views
— those fields are never read, not merely stripped afterwards.

Full policy: [api-authorization.md](./api-authorization.md).

---

## Testing

Three layers, each with a real blind spot. Knowing where each stops is more useful than the totals.

| Layer              | Command             | Covers                                                                           | Cannot see                                                    |
| ------------------ | ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Unit (128)         | `npm test`          | Authorization decisions, classroom chain logic, scoring, analytics               | Anything about the real database — MongoDB is mocked          |
| Browser (18)       | `npm run test:e2e`  | Both games' completion contracts, save creation and retry, classroom attribution | Authorization, until a test-only auth stub exists (issue #69) |
| Accessibility (26) | `npm run test:a11y` | WCAG 2.1 AA via axe, layout overflow at device sizes, reduced motion             | Audio-only instructions, touch target reach, game operability |

**The blind spot that has already cost the project:** the highest-severity bug found recently — a
database call issued before the connection was opened, hanging ten seconds then failing — was
invisible to all 128 unit tests because they mock MongoDB. It was found by reading the call graph.
Treat unit tests as covering _decisions_, not _wiring_.

**Accessibility runs as a reporting step, not a merge gate.** Real violations remain; the Playwright
report is uploaded on every CI run. Keyboard focus visibility is checked manually — an automated
version proved timing-dependent and unreliable, and a flaky check is worse than none.

---

## Operations

`GET /api/health` is the first thing to check. It separates a database problem from a broken game
build in one request, carries no learner data, and answers `503` on failure so an uptime monitor can
alert without parsing the body.

```sh
curl -s https://<site>/api/health | jq
```

| Check      | Reports                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `database` | Connection state. `degraded` means queries would buffer and time out — presents as a hang, not an error |
| `games`    | Per game: required files present, plus the exact Unity source SHA live. Makes rollback verifiable       |
| `release`  | The deploying commit, so an alert identifies which version is broken                                    |

**Error reports** are single-line JSON via `reportError` with a correlation id, environment, and
release. Context accepts **only primitives** — objects and arrays are dropped, so a quiz answer, a
child's name, or a request body cannot be attached by accident. Scopes stay distinguishable
(`unity-boot` vs `progress-save`) so alerts can separate them. `setErrorSink` is the seam for a
hosted tracker.

**When something breaks:** during a live class, **roll back rather than fix forward** — an educator
with thirty children waiting cannot absorb a fix-and-deploy cycle. Vercel instant rollback takes
effect immediately with no git operation.

Full runbook: [operations.md](./operations.md).

---

## Releasing

**Today `develop` is production.** Vercel deploys production from `develop`, so every merged pull
request goes live immediately. There is no staging and no moment at which anyone decides to release.
Until the switch below is thrown, treat every merge as a production change.

The replacement is built: `main` holds what is live, `develop` stays the integration branch, and
`promote-to-production` fast-forwards `main` to a chosen commit. It refuses anything that is not
already an ancestor of `develop` **and** has a green CI run for that exact commit — a green run on a
different commit proves nothing.

**Consequence that catches people out:** once `main` is production, reverting on `develop` no longer
changes what is live. You have to promote again.

Full detail: [releases.md](./releases.md).

---

## Launch checklist

Six items. None are blocked on code — they need dashboard access, real hardware, or a decision.
Ordered by risk, not effort.

### 1. Run the MongoDB restore drill — highest risk

Children's learning records are stored with no verified way to get them back. An untested backup is
an assumption, not a backup.

- Atlas → Backup → Restore, targeting a **new** cluster, never production
- `MONGO_URI=<restored-uri> npm run dev`
- Confirm an educator can open a class and see its roster and quiz results — "the cluster came up"
  proves nothing
- Delete the temporary cluster; record the date and who ran it

**Access:** MongoDB Atlas · **Time:** ~1 hour · **Detail:** operations.md

### 2. Point Vercel's production branch at `main` — needs dashboard

The switch that turns the release gate on. All three steps must happen together: a `main` that exists
while Vercel still deploys `develop` looks authoritative and goes stale immediately, which is why it
has not been created ahead of time.

```sh
git fetch origin
git branch main origin/develop
git push origin main
```

- Protect both branches — Settings → Branches
- Vercel → Project → Settings → Git → **Production Branch** → `main`
- Promote once, confirm with `curl -s https://<site>/api/health | jq .release`

**Access:** Vercel + repo settings · **Time:** ~15 min · **Detail:** releases.md

### 3. Run the device QA pass — critical path

The largest remaining item, and the only one whose output is _more work_ — it produces a defect list
that then needs fixing. Two non-negotiables:

- Run the full loop for both games **twice** — once signed in, once as a classroom participant. Those
  resolve ownership differently and have broken independently.
- **Play with sound off.** For audio-heavy games aimed at children, audio-only instructions are the
  most likely failure and the most consequential.

**Access:** real Chromebook + iPad, with sound · **Time:** ~1 week + fix tail · **Detail:**
accessibility-qa.md

### 4. Assign an owner to each alert — decision

Every alert in the runbook needs a named person. An alert with no owner is a notification everyone
assumes someone else is handling — which matters more here because the team that built this is
graduating.

**Access:** none · **Time:** ~30 min · **Detail:** operations.md

### 5. Choose an error-tracking vendor — decision

`setErrorSink` is the seam. Not chosen deliberately: it carries a recurring cost and a
data-processing agreement, for a product used by children. Confirm the vendor does **not** capture
request bodies or session replay by default — the reporting layer keeps answers and names out, and
session replay would put them straight back in.

**Access:** budget approval · **Time:** ~2 hours once chosen

### 6. Run the first Unity promotion — never executed

Built but never run; needs Unity licence secrets and a ~90 minute build. Two passes: once with
`promote` disabled to confirm the build half works, then again with it enabled. Low risk by
construction — the promotion job can push a branch and open a pull request and nothing else, and a
failed build opens no pull request.

**Access:** Unity licence secrets · **Time:** ~90 min, mostly waiting

---

## Where things stand

| Area                                   | Status                    | Remaining                                           |
| -------------------------------------- | ------------------------- | --------------------------------------------------- |
| Learning loop, both games              | Shipped                   | Verification on real devices                        |
| Classroom sessions, reopening, history | Shipped                   | —                                                   |
| Admin analytics                        | Shipped                   | —                                                   |
| Dependency security                    | Clean (0 vulnerabilities) | Six pre-existing React hook warnings need a browser |
| Observability & health checks (#49)    | Needs a person            | Restore drill, alert owners, vendor choice          |
| Deployment automation (#48)            | Needs a person            | First promotion run                                 |
| Accessibility & device QA (#50)        | Needs a person            | The manual pass                                     |
| End-to-end coverage (#47)              | Open                      | Deterministic database fixtures, per-test seeding   |
| Browser authorization tests (#69)      | Open                      | A test-only auth stub — not a middleware change     |

---

## Local setup

1. Clone and `npm install`
2. Create `.env` with secrets from a tech lead: `MONGO_URI`,
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
3. Install Prettier and ESLint editor extensions; enable format on save
4. `npm run dev`

**Contributing:** branch from `develop`, not `main`. Run `npm run lint` and `npm test` before opening
a pull request against `develop`. A Husky hook formats staged files on commit.

| Command                                 | Does                                         |
| --------------------------------------- | -------------------------------------------- |
| `npm run dev`                           | Local development server                     |
| `npm test`                              | 128 unit tests                               |
| `npm run test:e2e`                      | Browser tests (needs MongoDB)                |
| `npm run test:a11y`                     | Accessibility report                         |
| `npm run lint` / `lint:fix`             | ESLint and Prettier                          |
| `npm audit`                             | Expect 0 vulnerabilities                     |
| `node scripts/validate-webgl-build.mjs` | Check both embedded game builds are complete |

### Two environment gotchas that look like code bugs

- A local `next build` fails at prerender **without Clerk keys**. Compilation and type-checking still
  ran, so that failure is environmental. For a full local build:
  ```sh
  PK="pk_test_$(printf 'example.clerk.accounts.dev$' | base64 | tr -d '\n')"
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$PK" \
    CLERK_SECRET_KEY="sk_test_0000000000000000000000000000000000000000" \
    npm run build
  ```
- `npx tsc --noEmit` reports pre-existing errors in `e2e/` and `.next/`. Filter with
  `grep -E '^src/'` to see whether a change is actually clean.
- **Run `npm install` after switching branches** — dependencies moved substantially.
- The browser suite needs MongoDB, which is not available in every environment. **CI is the real
  check** for both the build and the browser tests.

---

## Deeper reading

| Document                                             | Covers                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [operations.md](./operations.md)                     | On-call runbook: health checks, alert thresholds, rollback, restore drill, incident triage |
| [releases.md](./releases.md)                         | Branch topology, migration to `main`, promotion workflow guarantees                        |
| [accessibility-qa.md](./accessibility-qa.md)         | Device matrix, manual launch pass, automation limits                                       |
| [api-authorization.md](./api-authorization.md)       | Route inventory, principals, response conventions                                          |
| [game-progress-bridge.md](./game-progress-bridge.md) | The contract Unity builds use to report progress                                           |
| [index.html](./index.html)                           | This handbook, rendered for reading and sharing                                            |
