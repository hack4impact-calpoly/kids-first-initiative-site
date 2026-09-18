# Releases

For the person deploying the website or a game. See [operations.md](operations.md) for rollback.

## Current production path

Checked 17 September 2026: `develop` is the default and Vercel production branch; `main` does not
exist remotely. Production deployment `dpl_6bjc7PXTKYJ6zn6xPgaxf5WJoJQB` is READY at website commit
`9dc8d04` (health/contrast fixes); [post-merge CI passed](https://github.com/hack4impact-calpoly/kids-first-initiative-site/actions/runs/35299122564).
Treat a merge to `develop` as a production release. The
controlled `main` path below is an optional future change, not an activated release mechanism.

1. Open a PR against `develop`; include behavior changed and verification evidence.
2. Require passing checks and review. Coordinate changes affecting lessons with the partner.
3. Merge, then verify Vercel deployed the expected commit and both game/quiz loops still work.
   Anonymous `/api/health` returns `200` when healthy and `503` for failed/degraded checks; match its
   `release` to the intended commit. Account/admin APIs must still reject anonymous callers.
   These checks passed on the current release. Follow the [runbook](operations.md) for each deployment.

For the upcoming documentation viewer release, verify **Admin dashboard → Documentation & handoff**
with an admin account. Signed-out users and non-admin accounts must not receive guides, including
direct `/adminDashboard/docs/index.html` and `/adminDashboard/docs/handoff.md` requests.

Preview retention is 7 days; Production is 30 days. Confirm a suitable rollback target still exists
and uses the organization-owned services before releasing. See [storage and retention](operations.md#deployment-storage).

## Activate Clerk production on Vercel

**Completed for this project during September 2026 handoff preparation.** The steps below are a
reconfiguration reference, not an outstanding task. Production uses live keys; Development and
Preview retain test keys. The production admin was provisioned and functional testing was reported
successful by the project lead. Incoming-owner access to both instances still needs confirmation.

The website uses Clerk's built-in Frontend API proxy at `/__clerk`, including its JavaScript
assets. It activates with a `pk_live_` publishable key; `pk_test_` keys keep local development and
previews on Clerk's development service, even in production builds. No additional rewrite or
proxy environment variable is needed. See [Clerk's proxy guide](https://clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi).

The service owner must complete activation; merging the code alone does not switch instances:

1. Create the Clerk production instance with application domain
   `kids-first-initiative-site.vercel.app` (no path). Keep the detected `/__clerk` proxy setting.
2. Deploy the proxy-supporting code. In Vercel's **Production** environment, set
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to the matching `pk_live_` / `sk_live_`
   pair, then redeploy. The public key is embedded at build time. Keep Development and Preview
   on test keys; never put the secret key in client code, Git, or a public variable.
3. In Clerk production, configure the session claim `{"role":"{{user.public_metadata.role}}"}`
   and review sign-in/sign-up settings. Provision and synchronize the first production admin as
   described in [Accounts and roles](handbook.md#accounts-and-roles); do not assume test accounts
   or role settings exist in the new instance.
4. Confirm Clerk's domain/proxy verification succeeds. If asked for a full proxy URL, use
   `https://kids-first-initiative-site.vercel.app/__clerk`. In a fresh browser, confirm requests
   to `/__clerk/v1/environment` and Clerk's JavaScript return successfully. Test educator
   registration/email verification, sign-in, sign-out, admin access (including MFA if enabled),
   and classroom guest joining. A non-admin must not gain admin access.

Automated tests cover proxy forwarding and anonymous access rules with synthetic keys, not live
Clerk accounts. Record the real-account checks before declaring activation complete. If activation
breaks sign-in, restore the previous matching key pair **and redeploy** while investigating;
rolling back code alone does not restore environment settings.

## Release a Unity game

Editing Unity source does not change the live website. Compiled WebGL files are committed under
`public/game/StatesOfMatter/` and `public/game/PenguinRun/` in this repository.

1. Verify the source revision in the owning Unity repository, including real gameplay.
2. In the **website repository**, run **Actions → build-unity-webgl** from `develop`.
3. Select `penguin-run` or `states-of-matter`, enter the source branch/tag/commit, and leave
   `promote` enabled.
4. Review the resulting PR: correct source SHA and game, only that game's directory changed,
   successful artifact validation and site build in the promotion job.
5. Approve queued PR workflows if GitHub requests it, inspect their results, and test the real
   game build on the intended devices. Merge into `develop` when the release is ready.
6. Verify the deployed markers `/game/<Game>/_source_sha.txt` and `_build_id.txt`, then play the
   game through to its post-quiz. A successful build does not prove it renders or plays correctly.

The workflow takes its Unity version from the source project's `ProjectVersion.txt`, pulls Git LFS
assets, stamps provenance, validates build files, and runs the site build before opening a PR.
Required credentials are in the [handoff checklist](handoff.md). A failed validation opens no PR.

Promotion uses `GITHUB_TOKEN`. GitHub can create PR workflow runs that wait for a maintainer's
approval; do not assume the checks ran automatically. The promotion job's own validation/build
provides evidence even before approval. See [GitHub's workflow-trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
The browser suite stubs Unity, so it does not replace a real game check.

### Unity build account

The build workflow uses a client-controlled Unity account with a Personal license. Confirm the
organization's license eligibility with Unity; a successful build is not a licensing review.
Store these **website repository Actions secrets**, never in Git or Vercel:

| Secret                  | Value                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| `UNITY_CLIENT_EMAIL`    | Unity account email                                                   |
| `UNITY_CLIENT_PASSWORD` | Unity password, not the Google sign-in password                       |
| `UNITY_CLIENT_LICENSE`  | Complete contents of that account's Hub-generated `.ulf` license file |

Follow [GameCI's Personal activation guide](https://game.ci/docs/github/activation/#personal-license).
On macOS the file is `/Library/Application Support/Unity/Unity_lic.ulf`; confirm Hub is signed into
the intended account before using it. A Google-linked account can set a Unity password through
**Account → Security → Password → Reset password**. Keep recovery details in the client's password
manager and re-check Hub sign-in after a password reset.

The working Personal license is already stored in `UNITY_CLIENT_LICENSE`. On the handoff machine,
a later Hub activation produced `UnityEntitlementLicense.xml` instead of the legacy `.ulf` file;
that XML is not a drop-in replacement for this GameCI v4 workflow. When changing only the password,
update only `UNITY_CLIENT_PASSWORD` and preserve the working license secret.

When changing accounts, keep the working credentials intact and test replacements on a branch.
Run **both games**, using recorded source SHAs and **`promote=false`**, then record successful run
links before merging the credential change. This builds artifacts without opening game-update PRs
or changing the live games. This migration passed for both games and merged in PR #85; links are in
the [handoff record](handoff.md). The old `UNITY_EMAIL`, `UNITY_PASSWORD`, and `UNITY_SERIAL` secrets
remain rollback-only and are not read by the current workflow. Retire them after the owner confirms
historical reruns/rollback no longer need them. Deleted secrets cannot be read back from GitHub;
deletion does not revoke the old Unity account or license.

## Proposed controlled release path

The checked-in [`promote-to-production`](../.github/workflows/promote-to-production.yml) workflow
is intended to fast-forward `main` to a commit already in `develop` with successful CI for that
exact commit. It has **not been accepted as an operational release path** in this handoff.

| Branch    | Intended use after activation                                           |
| --------- | ----------------------------------------------------------------------- |
| `develop` | Integration and preview deployments; PRs continue to target this branch |
| `main`    | Production; advanced only by the verified promotion mechanism           |

The repository and hosting owners must complete these steps together:

- [ ] Confirm the workflow token can read Actions runs. It currently declares `contents: write`
      only, while its CI lookup needs Actions read access; verify/correct permissions before activation.
- [ ] Configure branch protection/rulesets with actual CI check names and a promotion identity that
      is allowed to update `main`. Do not disable protection just to get a promotion through.
- [ ] Choose a reviewed `develop` commit with passing CI and create `main` at that commit.
- [ ] Change Vercel's Production Branch to `main`; confirm preview and production environments use
      the intended service credentials. Keeping the default GitHub branch as `develop` is fine.
- [ ] Run a promotion and confirm a Vercel production deployment actually follows. A pushed Git ref
      is not sufficient evidence of a deployment; token-triggered GitHub push workflows do not rerun CI.
- [ ] Rehearse rollback and the next corrected release, then update this page and [handoff.md](handoff.md).

Once verified, release through **Actions → promote-to-production**, selecting the reviewed commit.
A failed gate means no release: inspect CI, ancestry, and permissions. Never force-push `main` to
bypass a gate. A revert merged into `develop` must also be promoted to affect production.
