# Operations runbook

For the support owner and incoming developer. Contacts and account ownership belong in the
[handoff checklist](handoff.md). Partner-facing troubleshooting is in the [partner guide](partner-guide.md).

## When a class is blocked

1. Record the time, page/game, device/browser, affected group, and visible error. Keep learner names,
   answers, and credentials out of tickets and shared screenshots.
2. Check the current production deployment in Vercel, then database connectivity in Atlas. If
   sign-in fails, check the Clerk application. Use the public health probe below to narrow the problem.
3. If a recent release broke the lesson, have the hosting owner roll back to a known working
   deployment. Tell the educator whether to retry or pause, through the agreed support channel.
4. After recovery, verify a real learner can save progress and complete a quiz. Record the cause,
   affected release, recovery action, and any missing data for follow-up.

## Services and health

| Service                | Responsibility                                                            |
| ---------------------- | ------------------------------------------------------------------------- |
| Vercel                 | Website, API, static Unity builds; production currently follows `develop` |
| MongoDB Atlas          | Classroom rosters, game saves, quiz results, registered-user records      |
| Clerk                  | Registered-user identity and role claims                                  |
| GitHub Actions / Unity | Build games from their source repositories and open website promotion PRs |

Exact `GET`/`HEAD` requests to `/api/health` are public, without contacting Clerk. Other account/admin
APIs remain protected. Responses use `Cache-Control: no-store` and contain no learner records or
credentials. Verified live at `9dc8d04` on 17 September: health `200` with database and both game
checks healthy; anonymous `/api/users/me` and `/api/auth/admin-access` return `401`.

Later spot-check on 17 September at **19:53 PDT**: one `503` with database `degraded`, `readyState: 0`;
both game checks remained healthy. Three follow-up requests at **19:54 PDT** returned `200` with
database `readyState: 1`. Cause is unverified; review recurrence/logs with the monitoring owner
before sign-off. No application or database changes were made during these checks.

```sh
curl -i --max-time 20 https://kids-first-initiative-site.vercel.app/api/health
```

Expect `200` for healthy checks and `503` for failed/degraded checks. A `401` means the public probe
is still blocked (check the deployed commit and deployment protection), not that MongoDB is down.

| Field             | Meaning and limit                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `release`         | Website commit, or `null` if deployment metadata is unavailable                                                                   |
| `checks.database` | Connection state; this does not test successful reads/writes or restore capability                                                |
| `checks.games[]`  | Presence of `index.html`, `_source_sha.txt`, and `_build_id.txt`, plus source/build identifiers; this does not load the real game |

Use Vercel's deployment commit and the game markers under `/game/<Game>/` to identify a release.
`node scripts/validate-webgl-build.mjs` performs more complete
artifact checks locally/CI; actual gameplay still needs a browser and device.

## Logging and alerts

[`reportError`](../src/lib/server/observability.ts) emits JSON containing `scope`, `event`,
`correlationId`, environment, release, message, and optional stack. Search Vercel logs by those
fields where the call site uses them. A correlation ID identifies a report; it is not automatically
propagated through every request. Other code still uses ordinary console messages.

The context filter drops objects/arrays but accepts strings. **It does not redact names, answers,
secrets, error messages, or stacks.** Callers must supply non-identifying context and review the
error itself. Do not add raw request bodies or learner details to logs.

The browser's game-save and quiz-save failures largely use console logging; a server log monitor
will not see all of them. `setErrorSink` connects reports from this server module to an optional
tracker, not every browser error. Confirm coverage and data capture before selecting a vendor.

Suggested initial alerts, to tune after observing traffic:

| Signal                          | Starting threshold                                   | First action                                                      |
| ------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| Public health                   | Two consecutive failures, checked every five minutes | Inspect Vercel and Atlas                                          |
| Database errors                 | Any in five minutes                                  | Check database access, availability, and connection limits        |
| Production deployment fails     | Each failed production build                         | Inspect the build log; verify the prior deployment still serves   |
| Game boot / save / quiz failure | Configure after these browser events are collected   | Determine scope; protect unsaved work and inspect game/API errors |

Give every alert a named responder and backup in [handoff.md](handoff.md). Send a test alert and
record delivery. **Monitoring configuration and alert delivery remain unverified**; the working
health endpoint and these suggested thresholds do not prove that anyone receives outage alerts.

## Roll back

1. Open Vercel's production deployment history and select a known working deployment. Use
   **Instant Rollback** where available; confirm the target commit **and environment/database target**
   before proceeding. Older deployments may embed the former MongoDB or Clerk settings.
2. Verify the production URL, actual game loading, and a synthetic learner's quiz/save flow.
3. Create a revert PR against `develop` so the bad change does not return with the next release.
   Revert a normal/squash commit with `git revert <sha>`; use `git revert -m 1 <sha>` only for a merge
   commit after confirming its first parent. A game artifact promotion is reverted the same way.
4. After the corrected deployment passes verification, restore normal production promotion.
   If `main` has become production, the revert on `develop` must also be promoted.

A rollback does not undo MongoDB writes or update current project settings. The selected deployment
can still carry its original environment values, even when its code SHA matches another deployment.
The current verified release is `dpl_6bjc7PXTKYJ6zn6xPgaxf5WJoJQB` (`9dc8d04`). The earlier
post-cutover deployment `dpl_FmL4zJMMezjYxYgbK66gbtJGk7cn` (`da49c4e`) was preserved during cleanup,
but predates the health/contrast fixes; rolling back there makes anonymous health return `401` again.
`dpl_BByZthVvv41AemkXF1KT3WM3eLBv` used the old Mongo configuration and must not be used as a
client-production rollback target. Recheck that a target still exists and is eligible before a release.

Vercel may disable automatic production assignment after a rollback; check before assuming a
subsequent merge goes live.
See [Vercel's rollback procedure](https://vercel.com/docs/instant-rollback) and the
[release guide](releases.md).

## Backup and recovery

**Not required for this handoff work, per the project lead's 17 September 2026 decision.** Backup
configuration and restoration remain unverified. This optional procedure is retained for a future
database owner; no backup service or restore drill was performed as part of the readiness patch.

The repository is not a backup of learner records. If recovery work is commissioned, verify the
production cluster's backup features and fill in this record:

| Recovery setting                       | Confirmed value                |
| -------------------------------------- | ------------------------------ |
| Backup enabled / retention             | **Unverified** / \_\_\_ days   |
| Point-in-time recovery                 | **Unverified**                 |
| Acceptable data loss / time to restore | **_ / _**, agreed with partner |
| Authorized restore operator / backup   | **_ / _**                      |
| Last successful drill / evidence       | **_ / _**                      |

For a restore drill:

1. Restore a chosen backup into an isolated temporary cluster; never overwrite production for a drill.
2. Give only the drill operator access. Use a local/private environment pointed at that cluster
   and verify class history, rosters, quizzes, and saved progress against the expected snapshot.
   Use an approved test account; do not expose restored learner records in a public preview.
3. Record the snapshot time, elapsed recovery time, checks, and any missing records. Compare these
   with the agreed recovery targets.
4. Remove the temporary environment and cluster after recording evidence; revoke temporary access.

A real production restore requires coordination with the partner: stop conflicting writes and
identify which records would be lost since the restore point before replacing production data.

## Deployment storage

Vercel's Deployment Storage holds retained build output; Functions Storage holds server bundles.
Neither is the MongoDB learner database. [Vercel's storage guide](https://vercel.com/docs/deployment-storage)
explains both metrics and the dashboard view.

**Completed 17 September 2026:** removed 32 unused previews from closed/merged PRs after checking
they had no assigned aliases. The inventory fell from 101 to 69 deployments: all 38 production
deployments and 31 previews were preserved, including 25 older previews with aliases. Production
remained healthy at `9dc8d04`; no learner records, published game revisions, or alias assignments changed.

Project retention was then changed and read back: **Preview 7 days; Production, canceled, and
errored deployments 30 days**. No team defaults or billing plan were changed. The API's existing
`deploymentsToKeep: 10` value was left untouched; do not interpret it as the current platform-wide
minimum. Vercel's [Hobby policy](https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage)
documents a 10 GB Deployment Storage cap and exceptions for recent deployments.

Auto-deletion is not immediate, and protected aliases/active branches can keep deployments longer.
Vercel normally marks expired deployments within 48 hours; re-evaluation after an exception ends
can take up to 30 days. Successfully built deleted deployments can be restored for 30 days under
**Project → Settings → Security → Recently Deleted**. See the
[retention and recovery rules](https://vercel.com/docs/deployment-retention).

**Still unverified:** post-cleanup GB totals and savings. The supplied dashboard showed roughly
8–9 GB before cleanup; `vercel usage` returned `Costs not found`. Local tracing also included about
81 MB of game files in the health function; investigate that duplication only if Functions Storage
remains high. It is not a confirmed explanation for the dashboard total.

1. Open **Team → Usage → Deployment Storage** and compare both storage metrics by project.
2. Inventory old previews and production releases. Preserve the current production deployment,
   a verified post-cutover rollback target, and any previews still needed for review.
3. Agree on any further deletions or retention changes with the hosting owner. Check current alias
   assignments and open PRs before deleting; old deployments are not automatically disposable.
4. Record refreshed usage and headroom after processing. Do not claim a storage saving from the
   deployment count alone; verify rollback targets still exist before relying on them.

## Routine ownership

Before a teaching session, verify the intended release and test both games. Regularly review failed
deployments, browser reports, dependency alerts, backups, and service billing. Review access at each
team transition. Track incidents and follow-up work in the repository that owns the failure.
