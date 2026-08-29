# API Authorization Policy

API handlers are the authoritative security boundary. Browser route visibility and client-supplied IDs are not authorization.
Middleware also returns `401` for anonymous access to APIs that are not part of the credentialed classroom flow.

## Principals

- **Clerk user:** Identified only by `auth().userId`. The `admin` role comes from the Clerk session claim. A user may self-select only `player`, `parent`, or `educator` during initial registration.
- **Classroom participant:** A join code creates or resumes a participant and issues the `kfi_classroom_access` HTTP-only cookie. The cookie contains an opaque secret; only its SHA-256 digest is stored. Guest saves, quizzes, and events require a valid credential tied to an active classroom session.
- **Educator:** A signed-in user with an educator database role. Classroom reads are additionally scoped through the corresponding `Teacher` and `ClassroomSession` records.

Identity and ownership fields are always derived on the server. Request bodies cannot assign `userId`, `clerkId`, `classroomSessionId`, `studentDisplayName`, or an administrator role.
Classroom records are keyed to the authorized participant, including for signed-in students, so attempts remain isolated by classroom session.

## Route Inventory

| Route                                             | Method           | Access                                                         |
| ------------------------------------------------- | ---------------- | -------------------------------------------------------------- |
| `/api/admin/:id/role`                             | PATCH            | Administrator                                                  |
| `/api/admin/analytics`                            | GET              | Administrator                                                  |
| `/api/auth/admin-access`                          | GET              | Administrator                                                  |
| `/api/classroom-sessions`                         | GET, POST, PATCH | Signed-in educator; sessions are teacher-scoped                |
| `/api/classroom-sessions/join`                    | POST             | Public with an active access code; issues classroom credential |
| `/api/classroom-sessions/history`                 | GET              | Signed-in educator; only their own classes                     |
| `/api/classroom-sessions/history/:classId`        | GET              | Educator who owns the class, or administrator                  |
| `/api/classroom-sessions/history/:classId/reopen` | POST             | Owning educator only; no administrator bypass                  |
| `/api/events`                                     | GET              | Administrator                                                  |
| `/api/events`                                     | POST             | Signed-in session owner or credentialed classroom participant  |
| `/api/example`                                    | GET              | Administrator                                                  |
| `/api/gameData`                                   | GET              | Administrator                                                  |
| `/api/gameData`                                   | POST             | Signed-in owner or credentialed classroom participant          |
| `/api/gameData/:saveId`                           | GET              | Owner, administrator, or educator who owns the classroom       |
| `/api/gameData/:saveId`                           | PATCH            | Owner only                                                     |
| `/api/gameData/mine`                              | GET              | Signed-in user or classroom participant; own records only      |
| `/api/quiz`                                       | GET              | Administrator                                                  |
| `/api/quiz`                                       | POST             | Signed-in owner or credentialed classroom participant          |
| `/api/quiz/:id`                                   | GET              | Owner, administrator, or educator who owns the classroom       |
| `/api/quiz/:id`                                   | PUT              | Owner or administrator                                         |
| `/api/sessions`                                   | GET              | Administrator                                                  |
| `/api/sessions`                                   | POST             | Signed-in user; owner is derived from Clerk                    |
| `/api/sessions/:sessionId`                        | GET, PATCH       | Session owner or administrator                                 |
| `/api/users`                                      | GET              | Administrator                                                  |
| `/api/users`                                      | POST             | Signed-in user creating or refreshing their own record         |
| `/api/users/:id`                                  | GET, PUT         | Administrator                                                  |
| `/api/users/me`                                   | GET              | Signed-in user                                                 |
| `/api/users/me/photo`                             | PATCH            | Signed-in user                                                 |

## Response Rules

- `401` means no valid Clerk or classroom credential was supplied.
- `403` means the caller is authenticated but lacks the required role or participant binding.
- `404` is used for inaccessible individual resources so ownership cannot be inferred.
- `400` is limited to malformed or unsupported input.
- Unexpected errors return a generic `500` response; detailed failures remain in server logs.

## Classroom History

- A class is a chain of classroom sessions linked by `rootSessionId`, and is addressed by the id of
  the session that started it. Reopening appends a linked continuation rather than reviving a closed
  session, so historical records are never re-attributed.
- Reads follow the usual rule: the owning educator, or an administrator. An inaccessible class
  answers `404` rather than `403`, so one educator cannot probe for another's classes.
- Reopening is deliberately narrower than reading. It requires educator standing and ownership, with
  **no administrator bypass** — read access does not extend to changing who can join a class.
- History responses carry projected views only. Stored records include Clerk ids, quiz ids, and
  per-question answers, and a participant's `participantKey` embeds the student's Clerk id; none of
  that crosses an API boundary.
