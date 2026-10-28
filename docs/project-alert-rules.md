# Project Alerts

The three categories have independent eligibility rules. Reading the page or running a background scan never sends a notification. A user explicitly queues an alert, and the backend checks the current conditions again before accepting it.

## Backlog items and tasks

- Show active top-level backlog items whose deadline has passed and whose status is not `DONE`.
- Upcoming items do not appear. `REVIEW` is unfinished work and remains eligible when overdue.
- Sending requires a current assignee in the same team. Subtasks are not added to the top-level deadline list.

## Milestones

- Use the actual `SprintBacklog.milestone` relation, including Done and unassigned backlog items in the correct team scope.
- Progress is `Done backlog items / all active backlog items belonging to the milestone × 100`.
- A milestone is eligible only while active and `PLANNED` or `OPEN`, with `now < deadline <= now + 48 hours`, and an exact completion ratio below 80%.
- 3/5 Done (60%) appears; 4/5 (80%) and 5/5 do not. Closed, cancelled, past-deadline and more distant milestones are excluded.
- A milestone with no backlog has 0% progress. It does not require manual configuration.
- Submission/review state does not change progress eligibility. These belong to the submission workflow.
- The alert page has no Link backlog items, Member progress or Submission column. Associate backlog items with a milestone when creating/editing the backlog.

The legacy `/api/project-alerts/teams/{teamId}/milestones/{milestoneId}/backlog-items` endpoints remain for existing API clients. They now read/write the actual backlog relation; they do not maintain a separate selection for the progress calculation.

On startup, unambiguous legacy alert selections are copied to the actual relation once. Existing relations are preserved. Ambiguous selections or selections outside the team scope are logged for review, without guessing an owner. A nullable `migrated_at` field on `alert_milestone_backlog_config` records the completed migration so a later intentional unlink is preserved.

## Inactive members

- A current student must have assigned Todo work to qualify.
- The member must not have started any task during the last seven days, even if older Todo tasks remain.
- A start is a real transition from another status to `IN_PROGRESS`, attributed to the member. Description edits, unchanged saves, task creation, submissions, reviews and external contribution timestamps do not count as starts.
- Read actual status history from Sprint Backlogs, Board tasks and explicitly mapped UUID tasks. Ignore future, orphaned and foreign-tenant records.
- Allow seven days after joining/transferring to a team or receiving the first currently waiting Todo assignment. Reassigning an old task to a new member starts that member's grace period for that task.
- If older Todo work already exists, a newly assigned task does not hide that older waiting work. Starting any task resets the member's inactivity window.
- Members without assigned Todo work do not appear as inactive.
- `lastTaskStartedAt` replaces `lastContributionAt` in the member API. `pendingSince` identifies the earliest current Todo assignment used for the grace period. Completion percentages do not determine inactivity.
- Existing recipient checks, permissions, shared reminder cooldown, idempotency and outbox delivery remain in place.

## Background detection

`ProjectAlertMonitorJob` runs on the backend, independently of an open browser page. It detects overdue backlog IDs, at-risk milestone IDs and inactive member IDs per team. The latest scan is kept in memory; it is recomputed after a restart. Page reads and sends still evaluate current data, so stale scan results cannot authorize a send.

Defaults:

- `PROJECT_ALERT_MONITOR_ENABLED=true`
- `PROJECT_ALERT_MONITOR_INTERVAL_MS=60000`
- `PROJECT_ALERT_MONITOR_INITIAL_DELAY_MS=30000`
- `MEMBER_REMINDER_INACTIVE_DAYS=7`
- `MEMBER_REMINDER_COOLDOWN_SECONDS=86400`

The test profile disables the scheduled job; integration tests invoke the monitor explicitly against an isolated in-memory database.

## Verification

Run `ProjectAlertIntegrationTest` and `ProjectAlertMilestonePolicyTest` with Java 21. Coverage includes 3/5 vs 4/5, exact 48-hour and seven-day boundaries, stale sends, real Board/UUID task starts, reassignment grace, independent submission behavior, legacy migration, background scans without notifications, tenant scope, permissions, cooldown and concurrent retries. Run `npm run build` in the frontend for TypeScript and production bundle validation.
