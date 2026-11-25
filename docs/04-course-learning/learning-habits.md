# Personal Learning Goals & Habit Tracker

## Overview

My Learning now has a **Goals & Habits** tab for weekly and monthly study targets, a study timer, manual logs, a weekly checklist, and personal statistics. Login permissions and enrollment data come from the LMS. Study time and objective completion do not update official course, lesson, or exam progress.

## Data flow

The React panel uses the existing authenticated API client and account-scoped React Query caches. The Spring controller resolves the owner from `UserPrincipal`. Transactional services update that owner's records, and the statistics service derives totals directly from completed study data.

| Table | Records |
| --- | --- |
| `habit_goals` | Personal targets, calendar period, effective dates, archive date, and edit version |
| `habit_goal_targets` | Saved target values and effective windows for periods affected by edits or archives |
| `habit_sessions` | Timer or manual records, owner, optional course, state, date, seconds, notes, and idempotency key |
| `habit_session_intervals` | Running intervals for a timer session |
| `habit_objectives` | Personal checklist items, associated Monday, optional due date and course, order, and completion timestamp |

The owner is an existing LMS user. Optional course associations store the course ID and its display name when selected, which preserves history after a course becomes unavailable. Hibernate schema updates create the feature tables in the default setup. If automatic schema updates are disabled, apply `backend/src/main/resources/db/manual/learning-habits.sql` before starting the application.

## Personal API

Paths below are relative to `/api/learning/me`. Requests require `LEARNER_ACCESS` and `LEARNING_SELF_READ`. Selecting an enrolled course also requires `COURSE_READ`.

| Request | Inputs and result |
| --- | --- |
| `GET /study-courses` | Available enrolled-course IDs and display names |
| `GET /goals` | Goal details, status, and version |
| `POST /goals`, `PUT /goals/{id}` | Title, optional description, period, target minutes, start and optional end date. Updates also require the current version |
| `PATCH /goals/{id}/archive?version=` | Archive the owned goal |
| `GET /goals/periods?from=&to=&type=` | Planned and actual time, remaining seconds, and achievement for saved target periods |
| `GET /study-sessions?from=&to=&source=&page=&size=` | Paginated completed records with `hasMore`. Filters are optional and pages are zero-based |
| `GET /study-sessions/active` | Authoritative active state and timestamps, or HTTP 204 when there is no active timer |
| `POST /study-sessions/start` | UUID request key and optional course ID and title |
| `POST /study-sessions/{id}/{pause,resume,finish,cancel}?version=` | Transition the owned timer and return its current state |
| `POST /study-sessions/manual` | UUID request key, date, minutes, title, optional course and notes |
| `PUT /study-sessions/{id}`, `DELETE /study-sessions/{id}?version=` | Edit or delete an owned completed record. Edits include the current version in the body |
| `GET /objectives?week=&completed=` | List items for a Monday-based week, optionally filtered by completion |
| `POST /objectives`, `PUT /objectives/{id}` | Title, optional description and course, week, optional target date, and display order. Updates also require the current version |
| `PATCH /objectives/{id}/status`, `DELETE /objectives/{id}?version=` | Set completion with `completed` and `version`, or delete an owned objective |
| `GET /statistics?from=&to=`, `GET /activity?from=&to=` | Aggregated statistics or daily activity. Dates are inclusive and a range can cover up to 366 days |

Durations in input forms are normalized to whole minutes. Study summaries and timer responses expose elapsed seconds. Validation failures return HTTP 400, missing grants return 403, missing or unowned record IDs return 404, and conflicting state or version changes return 409.

## Calculation and lifecycle rules

- Goals have one active or scheduled target per period type. An edit applies to the current period and later periods. Closed periods keep their previous target and effective date window. Recorded study time is recalculated when study records change.
- Goal achievement is elapsed study seconds divided by planned seconds, multiplied by 100. The percentage may exceed 100 while the visual meter stops at 100.
- A timer tracks running intervals using server timestamps. Only completed records enter statistics. Unfinished timers expire 12 hours after start by default. A refresh or another browser tab reads the same server state.
- Weeks start on Monday. The application fallback timezone is `Asia/Ho_Chi_Minh`. A timer uses the timezone captured at start when splitting intervals at midnight. A manual record has a local study date and remains self-reported. Timer date or duration corrections are also self-reported.
- A day qualifies after 15 recorded minutes by default. The current streak can extend through yesterday until today ends. The longest streak uses all qualifying days. Weekly comparison bars show whole calendar weeks intersecting the selected range. Range totals and course breakdowns use the selected days.
- `LEARNING_HABITS_ZONE`, `LEARNING_HABITS_TIMER_LIMIT_HOURS`, `LEARNING_HABITS_MAX_MANUAL_MINUTES`, and `LEARNING_HABITS_ACTIVE_DAY_MINUTES` control the defaults.

## Roadmap and future reports

Roadmap commitments remain planning preferences. The weekly goal form can copy that value when a Roadmap commitment is available. Saving the target never changes the Roadmap. The timer, checklist, and statistics have no AI dependency.

A future report can reuse the statistics service and historical goal-period responses to compare planned and actual time. Study-session sources and day-level self-reported totals support separate reporting of manually entered time. Administrative reporting would need its own authorization and endpoints.

## Manual demo

1. Sign in to a running local LMS as an account with learner permissions and open **My Learning → Goals & Habits**.
2. Set a weekly goal, enter 180 minutes, and save. Open the monthly goal form to set a separate monthly target.
3. Start a General Study timer. Pause it, refresh the page, resume it, and select **Finish and save**. Confirm the record appears in **Study Session History**.
4. Log a completed session for 45 minutes. Confirm the history labels it **Manual · Self-reported** and the goal and activity totals update. Edit the duration to verify recalculation.
5. Add, complete, and reopen a weekly objective. Switch the week or status filter. Change the statistics range and calendar month, then open **Target history**.

## Browser captures

- [Desktop, light theme](learning-habits/goals-habits-desktop-light.jpg) shows the saved goal, both session sources, the checklist, and the activity charts.
- [Desktop, dark theme](learning-habits/goals-habits-desktop-dark.jpg) shows the goal overview.
- [390-pixel viewport](learning-habits/goals-habits-mobile.jpg) shows the mobile navigation and summary cards.

## Changed files

- Backend feature classes under `backend/src/main/java/com/example/starter_project_2025/system/learning/habits` and database-backed tests in the matching test package.
- `backend/src/main/resources/application.properties` and `backend/src/main/resources/db/manual/learning-habits.sql`.
- `frontend/src/pages/management/learning/index.tsx`, the panel and related components in `frontend/src/pages/management/learning/components/habits`, the API adapter in `frontend/src/api/features/learning-habits.api.ts`, and `frontend/tests/learning-habits.test.mjs`.
- This report and three browser screenshots.

## Verification

| Check | Result |
| --- | --- |
| Backend package and targeted tests | Passed. 30 tests across Goals & Habits, Learning Access, Learning Records, Learning Insights, and Roadmap. The seven feature tests use H2, a controlled clock, real transactions, and method-security checks. |
| Goal and streak scenario | 135 of 180 minutes yielded 75%, 45 minutes remaining, and three active days. Adding 45 minutes yielded 100% with the same three active days. |
| Frontend build | TypeScript and Vite production build passed. Vite reported a large-bundle warning. |
| Frontend tests | All three new mock-transport and formatting tests passed. The full suite ran 67 tests with 54 passes and 13 existing failures also observed before implementation. |
| Existing course integration | Three failures reproduced in an isolated run with the Goals & Habits classes excluded. Two involve unpublished-course enrollment and one involves workbook import expectations. |
| Manual SQL | Executed against H2 and created all five feature tables. |
| Browser and persistence | Verified target creation, a manual entry, objective completion and filters, and timer pause, refresh, resume, and save with AI disabled. The target, timer and manual records, and completed objective survived a packaged backend restart against the same H2 file. |
| RBAC and layout | The eligible Admin fixture opened the tracker in Admin View and saw no Student records. Backend tests also reject missing grants and cross-user mutations. Desktop light and dark themes rendered, and the 390-pixel page had no horizontal overflow. |

The work stayed on branch `backup/gr4`. Git short status reported 32 modified paths and 23 untracked entries, including pre-existing work. No commits were created.

## Known limits

Date-only logs cannot detect time-of-day overlap. Course history retains the name from the time the association was saved. The inspected user profile does not currently expose a timezone preference, so the configured fallback controls new records and calendar dates. Personal study time records a completed timer or a manual entry and does not certify learning or attendance.
