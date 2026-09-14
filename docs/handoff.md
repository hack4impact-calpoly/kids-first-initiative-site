# Handoff checklist

Use this page in the transfer meeting. Fill in owner names, private access records, and evidence
before accepting responsibility. A checked-in feature or green build is not operational sign-off.

Reviewed **5 September 2026**, website `3258a3f`. The [CI run for that commit](https://github.com/hack4impact-calpoly/kids-first-initiative-site/actions/runs/33461768805) passed; GitHub
lists `develop` as the default branch and the latest production deployment at that commit. There
is no remote `main` branch. Vercel settings, billing, backups, and ownership were not inspected.

## Transfer access and responsibility

Keep secret values in the organization's password manager. Record account/project identifiers and
invite the incoming owner; do not hand over a former contributor's personal login.

| Area                                | Incoming owner / backup     | Evidence to record                                                                  |
| ----------------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| Partner decisions and support       | **Unassigned / unassigned** | Contact channel, support hours, launch decision maker                               |
| Website and both Unity repositories | **Unassigned / unassigned** | Team access to all three repos; ability to review PRs and run Actions               |
| Vercel hosting                      | **Unassigned / unassigned** | Team/project, production URL and branch, deploy/rollback access, billing            |
| MongoDB Atlas                       | **Unassigned / unassigned** | Organization/project/cluster, database access, backup settings and restore operator |
| Clerk authentication                | **Unassigned / unassigned** | Development and production applications, admin access, role-claim configuration     |
| Unity builds                        | **Unassigned / unassigned** | License owner; Actions credentials usable by the incoming team                      |
| Learner data and service costs      | **Unassigned / unassigned** | Retention/deletion process, data-request contact, plans/costs/renewal dates         |
| Monitoring and incidents            | **Unassigned / unassigned** | Alert destination, responder, backup, escalation path                               |

Web CI and the Unity artifact's site-build check use dummy service settings, not MongoDB or Clerk
credentials. Unity compilation uses the client account's Actions secrets `UNITY_CLIENT_EMAIL`,
`UNITY_CLIENT_PASSWORD`, and `UNITY_CLIENT_LICENSE` (Personal license file); promotion uses the
built-in GitHub token. See [Unity credential setup](releases.md#unity-build-account) and confirm the
Vercel environments separately. Record the license owner and recovery access privately.

After this workflow change is merged and default-branch CI passes, remove the old Actions secrets
`MONGO_URI` and `CLERK_SECRET_KEY` and variable `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Legacy
`UNITY_REPO_TOKEN`, `HOSTING_REPO` (secret and variable), and `HOSTING_REPO_REF` are unused by the
current workflows. Review historical branches before rerunning them. Removing a GitHub secret does
not revoke the underlying credential at its provider. Test invitations and recovery access before
retiring the outgoing team's access.

## Resolve or explicitly accept

| Item                            | Current evidence / required next action                                                                                                                                                    | Owner role                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| Health monitoring               | Live unauthenticated `/api/health` returned **401** on 5 September. The proxy blocks it; resolve and verify public health checks before relying on uptime alerts. [Runbook](operations.md) | Developer                 |
| Production release gate         | `develop` still deploys production. Activate and rehearse the proposed `main` release path; its token permissions/protection still need verification. [Releases](releases.md)              | Hosting/repository owner  |
| Recovery                        | Backup configuration and an application-level restore have not been verified. Record retention, recovery targets, and a successful isolated restore.                                       | Database owner            |
| Real devices and accessibility  | No completed device sign-off is recorded. Play both games, verify Penguin Run's rail/track guides, and record limitations. [QA](accessibility-qa.md)                                       | Partner + developer       |
| Shared devices and guest return | Browser credentials/local Unity progress are shared; guest rejoin can create a new identity. Test learner turnover and reopening before promising continuity.                              | Partner + developer       |
| Monitoring coverage             | Browser save/quiz/Unity errors are not all wired to structured server reports. Verify alert delivery; choose an error tracker only if one is needed.                                       | Developer + support owner |
| Test coverage                   | Browser suites stub real services and Unity. Real authorization and database integration remain work items.                                                                                | Developer                 |

Existing issue threads: [E2E #47](https://github.com/hack4impact-calpoly/kids-first-initiative-site/issues/47),
[Unity promotion #48](https://github.com/hack4impact-calpoly/kids-first-initiative-site/issues/48),
[observability #49](https://github.com/hack4impact-calpoly/kids-first-initiative-site/issues/49),
[device QA #50](https://github.com/hack4impact-calpoly/kids-first-initiative-site/issues/50),
[browser authorization #69](https://github.com/hack4impact-calpoly/kids-first-initiative-site/issues/69).
The health and guest-return observations above were found during this documentation review; do not
assume the issue threads already contain them.

## Demonstrate the handoff

- [ ] Incoming developer runs the website from a fresh checkout using development services.
- [ ] Partner educator creates a class; a separate learner completes both game/quiz loops; results appear.
- [ ] Team tests reopening, a save failure/retry, and a second learner on the same device.
- [ ] Incoming developer builds a Unity revision, reviews its website promotion, and identifies the deployed revision.
- [ ] Service owner rehearses rollback and proves restored class/quiz data can be read.
- [ ] An alert reaches the named responder; everyone knows the support channel.
- [ ] Partner and technical owners record accepted limitations and the launch decision.

**Acceptance record:** date **_ · partner owner _** · technical owner **_ · release _** ·
evidence links **_ · accepted limitations and follow-up owners _**

Keep this record and service ownership current at each team transition. Update deployment state
here and in [releases.md](releases.md) after the production branch changes.
