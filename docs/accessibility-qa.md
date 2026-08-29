# Accessibility and Device Launch QA

A repeatable pass to run before launch and before any release that changes the learning loop.

The audience is young children in underserved communities, often on shared school hardware. That
shapes the priorities here: a control that is hard to hit, an instruction that is spoken only, or a
game that will not start are all launch blockers, not polish.

## What is automated

`e2e/accessibility.spec.ts` runs in CI as a **reporting step, not a merge gate** (`npm run test:a11y`).
It covers:

- WCAG 2.1 A/AA violations detectable by axe, on public pages
- No horizontal overflow at each viewport in the matrix below
- No long animations under `prefers-reduced-motion: reduce`

It does not fail the build. There are pre-existing violations that need a browser to triage, and a
permanently red required check trains people to ignore CI. The Playwright report is uploaded as a CI
artifact on every run — read it, and shrink what it reports.

Keyboard focus visibility is **not** automated. An automated version proved timing-dependent,
passing and failing across runs on pages that had not changed, and a flaky check is worse than none.
It is in the manual audit below.

Automated checks catch roughly a third of real accessibility problems. Everything below is the part
a machine cannot judge, and it is not optional.

## Supported device and browser matrix

| Target                           | Why it is on the list                                            | Input              |
| -------------------------------- | ---------------------------------------------------------------- | ------------------ |
| Chromebook, 1366×768, Chrome     | The most common device in the schools this serves                | Trackpad, keyboard |
| iPad 10.2" landscape, Safari     | Common classroom tablet; landscape is the usual game orientation | Touch              |
| iPad 10.2" portrait, Safari      | Learners hold tablets upright even when told not to              | Touch              |
| Desktop Chrome ≥1440 wide        | Educator and admin workflows                                     | Mouse, keyboard    |
| Desktop Safari ≥1440 wide        | Second engine for CSS and audio differences                      | Mouse, keyboard    |
| Phone, 390×844, Chrome or Safari | Parents opening a handoff link                                   | Touch              |

Anything outside this list is unsupported. Record it as such rather than leaving it ambiguous.

## Before each pass

- [ ] Note the release SHA under test: `curl -s https://<site>/api/health | jq .release`
- [ ] Confirm both game builds report `ok`: `curl -s https://<site>/api/health | jq '.checks.games'`
- [ ] Have a working classroom access code, or create one

## The learning loop — run per game, per device

Run for **both** States of Matter and Penguin Run. They have different bridge contracts and
different input demands, so passing one says nothing about the other.

- [ ] Pre-quiz renders, all answers reachable and selectable
- [ ] Game launches; the Unity canvas is visible and not clipped
- [ ] Core interaction works with this device's input (drag on touch, keyboard where offered)
- [ ] Progress saves mid-game (leave and return)
- [ ] Completion routes to the post-quiz exactly once
- [ ] Post-quiz shows the earlier score, and improvement reads correctly
- [ ] Result appears on the dashboard

Run once as a **signed-in player** and once as a **classroom participant joining with a code**. These
resolve record ownership differently and have historically broken independently.

## Accessibility audit — per device

### Visual

- [ ] No text or control is clipped or overlapping at this size
- [ ] Body text is legible without zooming
- [ ] Text and essential icons meet 4.5:1 contrast (3:1 for large text)
- [ ] Content respects safe areas; nothing sits under a notch or home indicator
- [ ] Layout survives 200% browser zoom

### Input

- [ ] Touch targets are at least 44×44 px — check the smallest ones: quiz options, close buttons, avatar picker
- [ ] Every action is reachable by keyboard; focus order follows reading order
- [ ] Focus is always visible, including on dark backgrounds — `globals.css` defines a `:focus-visible` ring; confirm it actually appears, since component libraries can override it
- [ ] No action requires a hover that a touch device cannot produce
- [ ] Drag interactions have a non-drag alternative, or are documented as a limitation

### Audio and instructions

- [ ] **Every essential instruction has a visual or text equivalent.** Play with sound off and confirm a child could still complete the task
- [ ] Audio does not autoplay in a way that blocks progress
- [ ] Narration can be replayed

### Motion

- [ ] With reduced motion enabled, nothing spins, bounces, or parallaxes continuously
- [ ] No content flashes more than three times per second

## Resilience

- [ ] Throttled to Slow 4G: loading states appear, nothing looks frozen
- [ ] Game interrupted mid-play (tab switch, lock screen): progress is not lost on return
- [ ] Classroom session expires mid-play: the learner is told to rejoin, not silently dropped
- [ ] Offline mid-save: the failure is surfaced and retryable, not swallowed

## Recording results

For each target, record **pass**, **fail**, or **accepted limitation**. An accepted limitation needs
a named product-owner decision and a reason — an untriaged blank is not a pass.

| Target          | Loop (SoM) | Loop (Penguin) | Visual | Input | Audio | Motion | Notes |
| --------------- | ---------- | -------------- | ------ | ----- | ----- | ------ | ----- |
| Chromebook 1366 |            |                |        |       |       |        |       |
| iPad landscape  |            |                |        |       |       |        |       |
| iPad portrait   |            |                |        |       |       |        |       |
| Desktop Chrome  |            |                |        |       |       |        |       |
| Desktop Safari  |            |                |        |       |       |        |       |
| Phone 390       |            |                |        |       |       |        |       |

File defects in the repository that owns them — game behaviour in the Unity repository, site
behaviour here — and link them from issue #50.

## Exit criteria

- [ ] Both learning loops pass on every supported target, or the gap is an explicitly accepted limitation
- [ ] No critical text or control clips at any supported viewport
- [ ] No essential instruction is audio-only
- [ ] Every launch-blocking finding is fixed or accepted by the product owner
- [ ] This completed table is attached to issue #50
