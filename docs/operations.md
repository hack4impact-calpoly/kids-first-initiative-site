# Operations Runbook

For whoever is on the hook when something breaks — including people who did not build this.

## System shape

| Piece          | Where it lives                                           | Notes                                                         |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Website        | Vercel, deployed from `develop`                          | Every merge to `develop` goes straight to production          |
| Database       | MongoDB Atlas, via `MONGO_URI`                           | Holds learner records: saves, quiz results, classroom rosters |
| Authentication | Clerk                                                    | Route protection runs in middleware (`src/proxy.ts`)          |
| Games          | Unity WebGL builds committed under `public/game/<Game>/` | Served as static assets from the website                      |

## Health check

`GET /api/health` — unauthenticated, carries no learner data.

```sh
curl -s https://<site>/api/health | jq
```

Returns `200` when healthy and `503` otherwise, so an uptime monitor can alert without parsing the
body. It reports:

- **database** — connection ready state. `degraded` means queries would buffer and eventually time
  out, which presents as a hang rather than an error.
- **games** — for each embedded build, whether `index.html`, `_source_sha.txt`, and `_build_id.txt`
  are present, plus the source SHA, build id, and build time. A missing file means the artifact was
  promoted incompletely, which otherwise only shows up as a blank canvas for a child.
- **release** — the deploying commit, so you can tell exactly what is live.

Point an uptime monitor at this every 5 minutes.

## Alerts worth configuring

| Signal                            | Threshold              | Why it matters                           | First response                  |
| --------------------------------- | ---------------------- | ---------------------------------------- | ------------------------------- |
| `/api/health` non-200             | 2 consecutive failures | Site or database is down                 | Check Vercel status, then Atlas |
| `scope: "database"` errors        | Any in 5 minutes       | Learner records are not being written    | Check Atlas connection limits   |
| `scope: "progress-save"` errors   | >5 in 15 minutes       | Children are losing game progress        | Check API logs and Atlas        |
| `scope: "quiz-save"` errors       | >3 in 15 minutes       | Learning outcomes are not being recorded | Same                            |
| `scope: "unity-boot"` errors      | >5 in 15 minutes       | A game build is broken for everyone      | Roll back the game artifact     |
| Vercel build failure on `develop` | Any                    | Production deploy blocked                | See rollback below              |

Ownership: assign one named person per alert before launch. An alert with no owner is not an alert.

## Error reports

Errors are written as single-line JSON via `reportError` in `src/lib/server/observability.ts`:

```json
{
  "level": "error",
  "scope": "progress-save",
  "event": "save-failed",
  "correlationId": "…",
  "environment": "production",
  "release": "abc123",
  "message": "…",
  "context": { "gameId": "PenguinRun" }
}
```

Two properties are deliberate and should be preserved:

- **Context is primitives only.** Objects and arrays are dropped rather than serialized, so a quiz
  answer, a child's name, or a whole request body cannot be attached by accident.
- **Scopes are distinguishable.** A WebGL boot failure and a save failure need different responses,
  so they must be separable in an alert query.

### Adding a hosted error tracker

`setErrorSink` in the same module is the seam. Wire it once at startup and every existing call site
begins reporting there with no other change:

```ts
setErrorSink((report) => Sentry.captureMessage(report.message, { extra: report }));
```

Choose a tool with a data-processing agreement appropriate for a product used by children, and
confirm it does not capture request bodies or session replay by default.

## Rollback

### The website

Fastest path is Vercel's instant rollback: **Deployments → pick the last known-good → Promote to
Production**. This re-serves a previous build without a git operation and takes effect immediately.

To roll back in git instead — which is what you want if the bad change must not come back on the
next deploy:

```sh
git switch develop
git pull --ff-only
git revert -m 1 <merge-commit-sha>    # -m 1 for a merge commit
git push
```

Confirm afterwards with `curl -s https://<site>/api/health | jq .release`.

### A game build

Game artifacts are committed to this repository, so a bad build is reverted like any other change.
Identify the live build first:

```sh
curl -s https://<site>/api/health | jq '.checks.games'
```

Then revert the commit that promoted it, and re-check that `sourceSha` moved back.

## Releasing a game build

Promotion is driven by the **build-unity-webgl** workflow. Do not copy artifacts by hand.

1. Actions → **build-unity-webgl** → Run workflow.
2. Choose the game and the exact source commit, tag, or branch to build.
3. Leave **promote** enabled to open a website pull request automatically.

The workflow builds the requested revision, stamps provenance markers, validates that the artifact
has a loader, framework, wasm, and data asset of plausible size plus an `index.html` that references
the loader, and confirms the diff touches only that game's directory. It then opens a pull request
stating the source repository, full source SHA, Unity version, and a link to the build run.

The promotion job can push a branch and open a pull request and nothing else. It cannot merge or
deploy: a human reviews and merges, and merging is what deploys.

If the build fails validation, no pull request is opened and the deployed site is untouched.

Concurrency is keyed per game, so two promotions of the same game cannot interleave.

## Database backup and restore

MongoDB Atlas takes the backups; this repository holds no copy of learner data.

**Before launch, confirm and record here:**

- [ ] Atlas backup is enabled on the production cluster
- [ ] Retention period: \_\_\_\_ days
- [ ] Point-in-time restore available: yes / no
- [ ] Who can perform a restore: \_\_\_\_

**Restore drill — run this once before launch, and record the date.** An untested backup is not a
backup.

1. In Atlas, choose **Backup → Restore** and target a **new** cluster, never production.
2. Point a local checkout at it: `MONGO_URI=<restored-cluster-uri> npm run dev`.
3. Verify an educator can open a class in Class History and see its roster and quiz results.
4. Delete the temporary cluster.
5. Record the drill date and who ran it: \_\_\_\_

Restoring over production is a last resort: it discards everything written since the snapshot,
including a class currently in session.

## Incident triage

1. **Check `/api/health`.** It separates a database problem from a broken game build in one request.
2. **Check Vercel** for a failed or in-progress deploy on `develop`.
3. **Search logs by `correlationId`** to follow one incident across reports; filter by `scope` to
   identify the subsystem.
4. **Decide: roll back or fix forward.** During a live class, roll back — an educator with thirty
   children waiting cannot absorb a fix-forward cycle.
5. **Record what happened** and, if the cause was not visible from the health check or logs, add the
   signal that would have made it visible.

## Known operational characteristics

- **`develop` is production.** There is no staging branch or release gate; a merge deploys. Treat
  every merge to `develop` as a production change.
- **Classroom sessions expire after 8 hours.** An educator reporting that "the code stopped working"
  is usually an expired session, not an outage. They can reopen the class from Class History, which
  issues a new code.
- **A reopened class retires every previous access code.** A student holding an old code cannot
  rejoin, by design.
- **`ClassroomSession` relies on a unique partial index** to guarantee one live continuation per
  class. It builds in the background on first connect, and a failure is logged as
  `ClassroomSession index build failed`. If a class ever shows two live sessions, check that first.
