# Operations runbook

For the support owner and incoming developer. Contacts and account ownership belong in the
[handoff checklist](handoff.md). Partner-facing troubleshooting is in the [partner guide](partner-guide.md).

## When a class is blocked

1. Record the time, page/game, device/browser, affected group, and visible error. Keep learner names,
   answers, and credentials out of tickets and shared screenshots.
2. Check the current production deployment in Vercel, then database connectivity in Atlas. If
   sign-in fails, check the Clerk application. Use the health probe below once the readiness patch is deployed.
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

The readiness patch makes exact `GET`/`HEAD` requests to `/api/health` public, without contacting
Clerk. Other account/admin APIs remain protected. Responses are not cached and contain no learner
records or credentials. The deployed baseline `da49c4e` still has the old `401` restriction;
confirm the fix is deployed before configuring a public monitor.

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

| Signal                                       | Starting threshold                                   | First action                                                      |
| -------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| Public health, after deployment verification | Two consecutive failures, checked every five minutes | Inspect Vercel and Atlas                                          |
| Database errors                              | Any in five minutes                                  | Check database access, availability, and connection limits        |
| Production deployment fails                  | Each failed production build                         | Inspect the build log; verify the prior deployment still serves   |
| Game boot / save / quiz failure              | Configure after these browser events are collected   | Determine scope; protect unsaved work and inspect game/API errors |

Give every alert a named responder and backup in [handoff.md](handoff.md). Send a test alert and
record delivery; an intended threshold is not evidence that monitoring exists.

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
The verified post-cutover baseline is `dpl_FmL4zJMMezjYxYgbK66gbtJGk7cn` (`da49c4e`);
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

The 17 September read-only check found a Hobby team, 99 READY deployments, and a project retention
policy of 30 days with 10 deployments kept. `vercel usage` returned `Costs not found`, so the actual
usage/limit and the warning remain unconfirmed. Local build tracing also included about 81 MB of
game files in the health function; investigate that duplication if Functions Storage is high.

1. Open **Team → Usage → Deployment Storage** and compare both storage metrics by project.
2. Inventory old previews and production releases. Preserve the current production deployment,
   a verified post-cutover rollback target, and any previews still needed for review.
3. Agree on specific deletions or a shorter retention policy with the hosting owner before changing
   anything. Do not treat all old deployments as disposable; deletion removes those rollback URLs.
4. Recheck usage after cleanup. No deletion, retention change, or plan upgrade was made in this review.

## Routine ownership

Before a teaching session, verify the intended release and test both games. Regularly review failed
deployments, browser reports, dependency alerts, backups, and service billing. Review access at each
team transition. Track incidents and follow-up work in the repository that owns the failure.
