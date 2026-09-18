# Handoff checklist

Use this page in the transfer meeting. The core service cutover is complete; incoming-owner access
and client acceptance still need to be recorded. Keep passwords and recovery codes in the
organization's password manager, never here.

## Verified baseline — 17 September 2026

Production: [kids-first-initiative-site.vercel.app](https://kids-first-initiative-site.vercel.app).
Vercel team `kids-first-initiative`, project `kids-first-initiative-site`; **`develop` deploys
production**. There is no remote `main`; the proposed branch switch is optional future work.

| Area                        | Completed / evidence                                                                                                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Website                     | Production deployment `dpl_6bjc7PXTKYJ6zn6xPgaxf5WJoJQB` is READY at `9dc8d04`. [Post-merge CI passed](https://github.com/hack4impact-calpoly/kids-first-initiative-site/actions/runs/35299122564).                                                                                              |
| Health and sign-in contrast | [PR #86](https://github.com/hack4impact-calpoly/kids-first-initiative-site/pull/86) merged. Post-merge checks: anonymous health `200`, account/admin APIs `401`, no axe color-contrast violations on either sign-in page. See the later health observation below.                                |
| Production authentication   | Clerk production keys and `/__clerk` proxy are active. The production admin was provisioned; test-instance users do not transfer automatically.                                                                                                                                                  |
| Production data             | Fresh organization-controlled Atlas database `kids_first_production`; no former developer data was migrated or wiped.                                                                                                                                                                            |
| Preview isolation           | Clerk test keys and separate `kids_first_preview` database/user. Preview database credentials were verified unable to read production. Historical deployments may still carry old settings.                                                                                                      |
| CI cleanup                  | Web tests/builds use dummy service settings. Unused GitHub database/authentication/hosting credentials were removed after [PR #84](https://github.com/hack4impact-calpoly/kids-first-initiative-site/pull/84).                                                                                   |
| Unity account               | [PR #85](https://github.com/hack4impact-calpoly/kids-first-initiative-site/pull/85) merged. Both games compiled with the new account's Personal license; neither test run promoted new game files.                                                                                               |
| Deployment storage          | Removed 32 unused, unaliased previews: 101 → 69 deployments immediately after cleanup. All 38 production deployments and 31 other previews preserved. Preview retention is now 7 days; Production, canceled, and errored deployments remain 30 days. [Details](operations.md#deployment-storage) |
| Functional testing          | Project lead reported testing looked good during handoff preparation. Exact device/browser coverage and incoming-team acceptance have not been recorded.                                                                                                                                         |

Unity build evidence: [Penguin Run, attempt 3](https://github.com/hack4impact-calpoly/kids-first-initiative-site/actions/runs/34816495085/attempts/3)
and [States of Matter](https://github.com/hack4impact-calpoly/kids-first-initiative-site/actions/runs/35182279518).
Published source revisions remain `690d3f93b3dc2153ff09f71f1309ca88dfc30b28` (Penguin Run) and
`94405c5340fda3eb00f751ebb1641ee7192032fb` (States of Matter).

[Production verification](https://github.com/hack4impact-calpoly/kids-first-initiative-site/pull/86#issuecomment-5724206865)
confirmed healthy database/game checks and `Cache-Control: no-store`; game revisions above are unchanged.
Readiness checks passed: 174 unit tests, 20 required browser tests, and 26 accessibility checks.
These do not establish incoming-owner access, delivered alerts, or a completed device matrix.

During this documentation refresh, one health request reported database degradation (`503`),
followed by three healthy `200` responses. Cause remains unverified; review this observation with
the monitoring owner. [Times and details](operations.md#services-and-health)

**Prepared for the next release:** admin dashboard → **Documentation & handoff** opens the protected
viewer at `/adminDashboard/docs`. It is not in the verified `9dc8d04` deployment above. After release,
verify access with an admin, a non-admin, and a signed-out browser. Repository copies remain public.

## Transfer access and responsibility

Invite the incoming owner and test access and recovery. A configured service is not proof that the
incoming team controls it. Names below are deliberately blank until confirmed.

| Area                                | Incoming owner / backup     | Evidence to record                                                             |
| ----------------------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| Partner decisions and support       | **Unassigned / unassigned** | Support channel/hours, launch decision maker, escalation contact               |
| Website and both Unity repositories | **Unassigned / unassigned** | Access to all three repos; ability to review PRs and run Actions               |
| Vercel hosting                      | **Unassigned / unassigned** | Team/project access, deploy/rollback access, billing and storage alerts        |
| MongoDB Atlas                       | **Unassigned / unassigned** | Organization/project/cluster access; production and Preview database ownership |
| Clerk authentication                | **Unassigned / unassigned** | Production **and test/Preview** instance access, recovery, role claims         |
| Unity builds                        | **Unassigned / unassigned** | New account/license owner and recovery access; secure credential record        |
| Learner data and service costs      | **Unassigned / unassigned** | Retention/deletion contact, billing contacts and plan/renewal records          |
| Monitoring and incidents            | **Unassigned / unassigned** | Alert destination, responder, backup and escalation path                       |

Actions uses `UNITY_CLIENT_EMAIL`, `UNITY_CLIENT_PASSWORD`, and `UNITY_CLIENT_LICENSE`;
promotion uses `GITHUB_TOKEN`. The unused `UNITY_EMAIL`, `UNITY_PASSWORD`, and `UNITY_SERIAL`
secrets remain for historical-workflow rollback only. Their eventual removal does not revoke the
old provider account. Preserve the working Personal license when rotating only the password.
See [Unity credentials](releases.md#unity-build-account).

## Remaining handoff checks

- [ ] Verify monitoring configuration and send a test alert to the named responder and backup.
      Review the transient database-degraded response above. The public probe is live; alert delivery
      remains unverified. [Runbook](operations.md#logging-and-alerts)
- [ ] Recheck **Team → Usage → Deployment Storage** after cleanup processing; record the current
      Deployment and Functions Storage totals and remaining headroom. Cleanup and retention changes
      are complete, but the resulting GB savings are unverified. [Storage procedure](operations.md#deployment-storage)
- [ ] Incoming developer runs a fresh checkout and demonstrates the release/rollback process.
- [ ] Record actual device/browser coverage from the completed testing; resolve or accept remaining
      shared-device, guest-rejoin, and accessibility limits. [QA checklist](accessibility-qa.md)
- [ ] Fill in owners above and obtain partner/technical acceptance below.

**Scope decision:** backup verification and a restore drill were excluded from this handoff work
by the project lead on 17 September 2026. They remain unverified, not certified unnecessary or
complete. The [optional recovery runbook](operations.md#backup-and-recovery) is retained for future use.

Known limits: browser tests stub service/game interactions; green CI is not full real-account or
Unity gameplay coverage. Guest rejoining may create a new identity, and shared browser profiles
can retain another learner's credentials/progress. Browser save/quiz/Unity errors are not all
connected to server alerts. These are follow-up/acceptance items, not claims of completed coverage.

## Acceptance record

Date: **\_** · partner owner: **\_** · technical owner: **\_** · accepted website commit: **\_**

Testing evidence/devices: **\_** · support channel: **\_** · accepted limitations and owners: **\_**

Related tracking: [observability #49](https://github.com/hack4impact-calpoly/kids-first-initiative-site/issues/49),
[device QA #50](https://github.com/hack4impact-calpoly/kids-first-initiative-site/issues/50),
[browser authorization #69](https://github.com/hack4impact-calpoly/kids-first-initiative-site/issues/69).
Update this record after release and at each ownership transition.
