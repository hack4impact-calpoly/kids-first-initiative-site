# Partner and educator guide

Kids First Initiative lets children learn through games and lets educators review participation
and quiz results. This guide covers everyday use. The [handoff checklist](handoff.md) identifies
what your organization needs to own; the [developer handbook](handbook.md) covers maintenance.

**Website:** [kids-first-initiative-site.vercel.app](https://kids-first-initiative-site.vercel.app)
• Updated 17 September 2026. Setup and project-lead functional testing are complete; incoming-owner
contacts, actual device coverage, and client acceptance still need recording in the [handoff](handoff.md).

## What learners do

Join a class → answer a short pre-quiz → play → answer the post-quiz → review results.

| Game             | Activities and learning focus                                                      |
| ---------------- | ---------------------------------------------------------------------------------- |
| States of Matter | Matter Kitchen, Pipe Rescue, and State Lab: heating, cooling, and changes of state |
| Penguin Run      | Three track-building levels: gravity, friction, and potential energy               |

Classroom learners enter a display name and class code without creating an account. Personal
players can register separately. Educators manage their own classes; administrators review results
across classes. Parent accounts have a separate dashboard; verify the parent workflow before
including it in a partner rollout.

## Run a class

1. **Prepare.** Have the support contact from the [handoff checklist](handoff.md) available. Test
   both games on the actual school device and network, including sound and dragging. Use separate
   browser profiles for the educator and the test learner.
2. **Sign in.** Open [educator sign-in](https://kids-first-initiative-site.vercel.app/login/facilitator).
   New educators [register](https://kids-first-initiative-site.vercel.app/sign-up/facilitator) and select the educator role.
3. **Open the class.** Visit [Create Class](https://kids-first-initiative-site.vercel.app/educatorCreateClass), name it, and share the displayed code or join
   link. Learners open [player sign-in](https://kids-first-initiative-site.vercel.app/login/player), enter a display name and the code, then select **Continue**.
   Confirm they appear in the class roster.
4. **Teach.** Ask each learner to complete the pre-quiz before playing. Finish the game and its
   post-quiz; in States of Matter, use **TAKE THE QUIZ** on the final result screen. Keep the browser
   open if a save fails and follow its retry/rejoin message.
5. **Review.** Use the [educator dashboard](https://kids-first-initiative-site.vercel.app/educatorDashboard) for current results and [Class History](https://kids-first-initiative-site.vercel.app/educatorClassHistory) for past
   classes and rosters. Confirm post-quiz results appear before ending the lesson.
6. **Return later.** Reopen the intended class from Class History and share the new code. Starting
   a new class makes a separate history entry. Either action can close another active class owned
   by the same educator, so coordinate before doing it during a lesson.

Class codes expire after **eight hours**. Reopening preserves the class's history, but guest learners
may appear as new participants when they join again. Re-entering the same name does not establish
the same learner identity.

## Practical limits

Use one learner per browser profile during a session. The classroom credential is shared across
tabs in that profile, so opening another tab is not a separate learner login. Agree on and test a
device-reset process before sharing hardware between learners.

Progress is recorded when game messages reach the website successfully. An internet connection is
required; there is no guaranteed offline recovery. Unity also keeps local browser progress, and
website records do not guarantee that a game resumes on another device. Avoid clearing browser
storage or switching devices midway through a lesson.

The device checklist targets Chromebooks, iPads, desktop Chrome/Safari, and phone access to parent
pages. These are **QA targets, not a certified support list**. The partner and developer must record
the devices they actually tested in the [device QA checklist](accessibility-qa.md), including whether
instructions work with sound off and whether drag controls are usable.

## Read results carefully

Pre- and post-quiz scores are percentages of correct answers. A move from 40% to 60% is a gain of
20 percentage points. Missing attempts are not zero scores.

The admin dashboard averages scores within each class, then averages the class averages equally;
a small class has the same weight as a large class. Its gain subtracts the available pre average
from the available post average, which may involve different learners. It is not a matched measure
of each child's improvement or proof that the game caused a learning gain.

Record the class scope, date, completion counts, and missing results when sharing outcomes. Learner
totals can count one child under multiple identities; “games played” counts saved game records,
not necessarily finished games. Some admin API counts use different filtering scopes; ask the
developer to verify definitions before using them in funder or impact reports.

## Data and support

The database stores display names, classroom participation, game progress, and quiz answers.
Registered accounts also include profile/contact information. Educators can access their own
classes; administrators have broader access. Use the minimum display-name detail needed for a
lesson and keep learner records out of public tickets, screenshots, and shared chat.

The partner must designate who handles data access, retention/deletion requests, and approved
reporting. There is no documented self-service deletion workflow; route requests to that owner.
Account-free classroom access does not mean that the stored records are anonymous.

| Problem                   | What to do                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Code no longer works      | Ask the educator to confirm the current class and issue/share its current code                                 |
| Blank or frozen game      | Note the game, device/browser, time, and visible message; ask support before refreshing if work may be unsaved |
| Save failed at completion | Keep the tab open, restore connectivity, and use **Try Again** or the sign-in/rejoin action shown              |
| Result missing            | Check the correct class and whether the post-quiz finished; report it as missing, not as a zero                |
| Several learners blocked  | Pause the activity and contact the named support owner, who follows the [operations runbook](operations.md)    |

A useful support report says which page/game, time and timezone, device/browser, what was expected,
what happened, and whether one or all learners are affected. Include a screenshot only after
removing learner details. The organization should give educators one support channel before rollout.
