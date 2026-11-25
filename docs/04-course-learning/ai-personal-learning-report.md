# AI Personal Learning Report

## Access

Open **My Learning → Reports** or use **Open Reports** in My Profile. Select a reporting period, language, included sections, and Standard or AI-enhanced mode. The form displays the exact date range before submitting. The detail view can create an updated report and export the saved snapshot as PDF or XLSX.

## Architecture

Before this change, My Learning displayed an unavailable statistics placeholder in Reports. It now uses a shared, learner-owned report module. A Spring service validates the period, reads the authorized learning sources, and stores a versioned statistical snapshot. Standard generation ends there. AI-enhanced generation commits that snapshot first, then calls the existing provider outside its database transaction. A short database lease prevents overlapping analysis requests for the same report and lets a later retry recover an abandoned request. The shared gateway applies a per-user cooldown and provider concurrency limit.

| Section | Authoritative source and limitations |
| --- | --- |
| Overview and courses | Existing enrollments, lesson progress and certificate-backed completion. Counts and progress describe the state at generation. Enrollments in period use the recorded enrollment date. There is no reliable reconstruction of historical course status, exact completion dates or removed enrollments. |
| Study and habits | Habit Tracker allocates completed timer intervals over local days and counts manual entries and timer corrections as self-reported. Canceled timers contribute no time. Date-only logs cannot establish overlap with timer intervals. |
| Roadmap | Current saved roadmap, revision, generation time and recommendation list. A phase is complete when it has courses and all are complete. The current phase is the first incomplete phase with an available unfinished course. Historical reports retain the roadmap they captured. |
| Objectives | Due dates within the period, or overlapping objective weeks if no due date exists. Status and overdue counts are measured at generation. In-period completions use the saved completion timestamp. Reopened objectives have no event history. |
| Assessments | Latest scored attempt per exam from the existing learner scores service, filtered to published results and submission dates within the period. Normalized score uses final score divided by maximum. The data does not support a complete attempt count, longitudinal trends across attempts, or course-level pass rates. |

## Statistical rules

- Week boundaries are Monday through Sunday, months and quarters use calendar boundaries, and ongoing periods end on the application-local current date. The timezone comes from the Habit Tracker configuration, which defaults to `Asia/Ho_Chi_Minh`. The app has no learner timezone preference.
- Course completion rate uses all eligible enrollments. Unknown status has a separate count. The average is unweighted and uses measurable course percentages only.
- Historical weekly targets are preferred for weekly and short custom reports. Monthly targets are preferred for monthly, quarterly and custom ranges of at least 28 days. A matching alternate target can fill uncovered dates. Each date uses at most one target, prorated over its effective window. Achievement counts recorded seconds on days covered by a target divided by planned seconds. Remaining study time is floored at zero. Recorded totals also display uncovered days' activity.
- Active days use the existing Habit Tracker threshold. The current streak uses recorded days through the report end date. The longest streak counts only dates inside the report range.
- Published assessment averages weight each result equally. No score or time entry changes LMS course or skill completion.

## Persistence and authorization

The `personal_learning_reports` table stores metadata, request fingerprint, the statistical JSON snapshot, the optional AI JSON snapshot, and the AI lease and status. Schema version is currently one. An owner/date index supports history and a unique owner/request key protects against duplicate submissions. Rename changes metadata. Generate Updated Report creates an independent record. Delete removes only the saved report.

Hibernate creates the table in update mode. Apply `backend/src/main/resources/db/manual/learning-reports.sql` on installations that manage schema changes explicitly. `app.learning.reports.max-days` defaults to 366 and is bounded by the Habit Tracker's maximum. All operations require `LEARNER_ACCESS` and `LEARNING_SELF_READ` and resolve owner from the principal. The report detail and export check current course, lesson-progress, and exam grants where the snapshot contains those sections or metrics. Admin View does not extend ownership.

## API

All paths are relative to `/api/learning/me/reports`.

| Method and path | Purpose |
| --- | --- |
| `GET /options` | Server date, timezone, maximum range, selectable sections and AI availability |
| `POST /` | Create or replay a report. JSON fields are `requestKey`, `title`, `type`, `from`, `to`, `mode`, `language` and `sections` |
| `GET /` | History, summary counters and optional `type`, `from`, `to`, `page` and `size`. Date filters match overlapping reporting periods |
| `GET /{id}` | Saved detail. Also exposes pending analysis status |
| `PATCH /{id}/title` | Rename with JSON `title` |
| `DELETE /{id}` | Remove a saved report |
| `POST /{id}/retry-ai` | Retry analysis using the saved statistical snapshot |
| `GET /{id}/export/xlsx` | Download the authorized saved snapshot as a workbook |

PDF is generated in the browser from the authorized detail DTO. It uses the same localized report blocks as the detail view. A4 pages use browser Unicode shaping for Vietnamese and include page numbers. The PDF pages are rasterized, so text cannot be selected. The XLSX uses Apache POI with formatted numeric cells, dates, and strings for titles and AI text. Text beginning with a formula character stays a string.

## AI configuration

Use the app's shared Gemini integration. Configure `AI_ENABLED`, `GEMINI_API_KEY` or `AI_API_KEY`, and the existing model and endpoint settings as needed. The provider receives approved aggregate values, course aliases with status, skill level when available, and limitation codes. It does not receive source records, private notes, names, or account identifiers. The JSON response contains a summary, evidence-linked achievements and improvement areas, recommendations, three to five next actions and limitations. Unknown evidence or course aliases, invalid structure, and numeric digits in prose cause rejection. The UI and exports show metric values from the backend snapshot. Standard generation remains available during provider failures.

## Files

- Backend implementation under `system/learning/report` and a reusable reporting projection in `HabitStatistics`.
- Report table SQL under `backend/src/main/resources/db/manual`.
- UI, API adapter and PDF implementation under `frontend/src/pages/management/learning/components/reports`, with entry points in My Learning and My Profile.
- Backend report and Habit Tracker tests, plus `frontend/tests/learning-reports.test.mjs`.

## Manual demo

1. Sign in with learner permissions and open **My Learning → Reports**.
2. Choose **Generate report**, select a period and **Tiếng Việt**, then generate a Standard report. Select a period containing saved study logs to inspect time totals.
3. Open the saved report from history. Compare its numbers with **PDF** and **XLSX**.
4. Change a source study log and generate an updated report. Both snapshots remain available. Try AI-enhanced mode with AI disabled to see the fallback status.

## Verification and samples

- The backend package passed with 29 targeted tests. One additional H2 test verified the Habit Tracker reporting calculation against the pre-edit historical goal and separate daily study logs. It measured 630 of 720 minutes, 87.5% achievement, 90 minutes remaining, and a longest in-period streak of two days.
- The H2 report tests verified the 40% course completion rate, 54% average course progress, objective and roadmap fixture counts, immutable snapshots, duplicate request replay, ownership rejection, formula-safe workbook text, AI fallback and validated mock AI output.
- TypeScript and the Vite production build passed. The full frontend suite recorded 56 passing and 13 failing tests. The same 13 failures occurred in the pre-change baseline. Both new frontend tests passed.
- In the browser with AI disabled, the Student fixture generated a Vietnamese report, reopened it after refresh, and generated another report in Standard mode. The eligible Admin fixture did not see the student's reports. The 390-pixel frame showed no horizontal overflow.
- The saved browser report, both rendered A4 PDF pages and XLSX cells agreed on 45.05 recorded minutes, 60 planned minutes, and 14.95 minutes remaining. Vietnamese accents and PDF page numbers were checked visually.
- Mocked AI tests passed. After explicit approval, a separate live Gemini test used an isolated, in-memory H2 fixture with 45 minutes of synthetic study activity. Gemini produced validated analysis with three next-period actions. Both the generation response and the subsequent saved-report read returned `AVAILABLE`, with the authoritative study total still 2,700 seconds.

[Report history](learning-report/report-history.jpg) · [Report detail](learning-report/report-detail.jpg) · [Mobile](learning-report/report-mobile.jpg) · [Sample PDF](learning-report/sample-vi.pdf) · [Sample XLSX](learning-report/sample-vi.xlsx)

The work remains on `backup/gr4`, with 32 modified paths and 30 untracked entries including prior work. No commit, push or branch change was made.
