# Project Alerts

Project Alerts has two categories: overdue backlog items/tasks and at-risk milestones. Viewing candidates or running the background scan does not send anything. A manager explicitly selects Send alert.

## Overdue tasks

- Show active top-level backlog items whose deadline has passed and whose status is not `DONE`.
- Items assigned to a sprint are eligible only while that sprint is `ACTIVE`. Items in `PLANNED`, `COMPLETED` or `CANCELLED` sprints are excluded from lists, detection and new sends.
- Product backlog items without a sprint keep the same deadline rules. Starting a sprint does not change task deadlines.
- Sending requires a current assignee in the same team. Subtasks are excluded.
- The backend rechecks status, deadline, sprint, version and team before sending an entire batch. An invalid selection rolls the whole send back.

## Milestone risks

- Use the actual `SprintBacklog.milestone` relation, including Done and unassigned backlog items in the correct team scope.
- Progress is Done backlog items divided by all active linked backlog items.
- Eligible milestones are active and `IN_PROGRESS`, with `now < deadline <= now + 48 hours` and an exact completion ratio below 80%.
- 3/5 Done (60%) appears; 4/5 (80%) does not. A milestone with no backlog has 0% progress.
- Planned, submitted, accepted, rejected, cancelled and past-deadline milestones do not qualify. The Milestone module owns these lifecycle transitions.
- Send one milestone per alert. Active student members of the team are recorded as recipients.
- A blank milestone note receives the default deadline/progress warning.
- Link items through the backlog item form. The legacy linking API continues to write this same relation.

## Sent alerts in the workspace

- The workspace tab labelled Alerts occupies the former Feedback tab. The existing internal `feedback` navigation key remains compatible; feedback/review APIs belonging to other modules are unchanged.
- `GET /api/workspaces/{workspaceId}/alerts` lists only committed task/milestone send batches for that workspace's tenant, team and project. It never lists unsent candidates or legacy inactivity reminders.
- Workspace access is checked on every request using the existing workspace context. Members need workspace read access, not permission to send or manage alerts.
- The read endpoint supports `kind=BACKLOG|MILESTONE`, zero-based `page`, and `size` from 1 to 100.
- Notes, sender, send time, item titles, assignee, deadline and progress are shown. Item details are the immutable snapshots captured at send time.
- Completing a task or reaching 80% removes a current candidate but preserves the posted alert and its original snapshot.
- Existing committed task/milestone send history is also visible; no data reset, duplicate post table or database migration is required.
- The frontend can refresh and polls every 15 seconds while the tab is open.

## Send success and delivery status

A committed `project_alert_batches` row is the team's workspace notification. The send transaction also writes its recipients, snapshots and audit. Success returns `SENT` after this transaction commits, so the team can read the notification immediately. The UI uses Send alert, Sending... and Sent. There is no approval step.

The existing outbox is retained for integration channels. Its internal `PENDING` state is separate from the posted workspace notification; `SENT` confirms workspace posting and does not claim email delivery. An outbox/database failure rolls back the post and audit. Replaying the same request key creates no duplicate workspace post.

A team needs an available matching workspace for a new send. Completed/cancelled projects reject new alerts but keep their sent history.

## Retired inactivity category

Project Alerts no longer offers inactivity options, member results routes or inactivity sending. Its former read routes return 404; a new `INACTIVE` send/filter is rejected. The background monitor only detects tasks and milestones.

The `INACTIVE` enum value and old records remain readable internally for historical data compatibility. Shared member, reminder, task and workspace business modules are not removed.

## Verification and demo

Run `ProjectAlertIntegrationTest`, `ProjectAlertBacklogPolicyTest` and `ProjectAlertMilestonePolicyTest` with Java 21, then `npm run build` in the frontend.

Coverage includes planned/active sprint gates, stale and mixed sends, retry deduplication, rollback, sent-only workspace lists, immutable snapshots after completion, 60%/80% boundaries, pagination, retired inactivity, workspace permissions, roster changes and tenant/team isolation.

Demo sequence:

1. Give an unfinished task a past deadline in a Planned sprint: it is absent from task candidates.
2. Start the sprint, refresh Alerts and send that task's alert.
3. Open the same team's workspace and its Alerts tab: the sent note and task snapshot are visible.
4. Send a milestone risk at 3/5 Done and within 48 hours of deadline.
5. Complete the overdue task so progress becomes 4/5: current candidates disappear, while both sent notices remain in the workspace.
