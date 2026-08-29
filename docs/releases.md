# Releases and Branch Topology

## Where things stand today

**`develop` is production.** It is the repository default branch, and Vercel deploys production from
it. Every merged pull request goes live immediately. There is no staging environment and no moment
at which someone decides to release — it simply happens.

That is workable for a team shipping to itself. It is a poor fit for a product used by children in
classrooms, where a bad deploy lands in the middle of a live lesson.

## The target

| Branch    | Role                                                                   |
| --------- | ---------------------------------------------------------------------- |
| `main`    | What is live. Only ever fast-forwarded to a verified `develop` commit. |
| `develop` | Integration. Pull requests merge here and get a preview deploy.        |

`main` never diverges from `develop`'s history, so anything in production is always a subset of what
has been reviewed and passed CI.

## Enabling it

Three steps. The first two are in this repository; **the third is the one that actually switches
production over and can only be done from the Vercel dashboard.**

1. **Create `main` from a known-good `develop` commit.**

   ```sh
   git fetch origin
   git branch main origin/develop
   git push origin main
   ```

2. **Protect both branches** — Settings → Branches:

   - `main`: no direct pushes; allow the promotion workflow only.
   - `develop`: require a pull request and a passing `ci` check before merge.

3. **Point Vercel at `main`** — Project → Settings → Git → **Production Branch** → `main`.

   Until this is done, `main` exists but nothing reads it, and `develop` continues to deploy to
   production. This is the single switch that changes behaviour, and it is deliberately left to a
   person with dashboard access rather than assumed.

Optionally set the repository default branch to `main` so clones and pull requests point at the
right place. Existing pull requests targeting `develop` are unaffected.

## Releasing

Once enabled, run **Actions → promote-to-production** and give it a commit or branch (default
`develop`).

The workflow refuses to promote unless:

- the commit is an **ancestor of `develop`** — promoting an arbitrary ref would put code into
  production that never went through review; and
- the **`ci` run for that exact commit concluded `success`** — a green run on a different commit
  proves nothing about this one.

It then fast-forwards `main`, which is what Vercel deploys. Confirm with:

```sh
curl -s https://<site>/api/health | jq .release
```

## Rolling back

Both paths are in [operations.md](./operations.md). In summary:

- **Fastest:** Vercel → Deployments → last known-good → Promote to Production. No git operation, and
  it takes effect immediately. Use this during a live class.
- **Durable:** revert the offending commit on `develop`, then promote again. Use this when the bad
  change must not return on the next release.

Reverting on `develop` without promoting does **not** change production once `main` is the
production branch — that is the point of the split, and the thing most likely to surprise someone
used to the current setup.

## Before the switch

- [ ] `main` created and pushed
- [ ] Branch protection configured on `main` and `develop`
- [ ] Vercel production branch changed to `main`
- [ ] One promotion run end to end, and `/api/health` confirms the release SHA
- [ ] One rollback rehearsed via Vercel instant rollback
- [ ] `docs/operations.md` updated to say `main` is production rather than `develop`
