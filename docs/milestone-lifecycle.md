# Milestone lifecycle (six states)

`milestones.lifecycle_status` is the business state. `status` and `execution_status` remain as compatibility columns for old clients. All milestone list/detail/create responses and filters use `lifecycleStatus`; reviewers also receive `milestoneLifecycleStatus` on submission responses. A startup backfill derives the new value from existing submission and milestone rows. It keeps historical submission versions and reviews unchanged.

| State | Entry | Allowed next state | Edit/delete |
| --- | --- | --- | --- |
| `PLANNED` | Created, before its start date | `IN_PROGRESS` automatically at 00:00 on `startDate` in the tenant time zone | Full planned edit; delete while no submission |
| `IN_PROGRESS` | Scheduled start | `SUBMITTED` on student submit; `REJECTED` after the maximum submission cutoff without a submission | Description and extension of deadline; delete only without submission records, with UI warning |
| `SUBMITTED` | Student submits V1 or a later version | `ACCEPTED`, `CHANGES_REQUESTED`, `REJECTED` through reviewer decision | Neither |
| `CHANGES_REQUESTED` | Reviewer requests changes with feedback | `SUBMITTED` only when a new version is submitted | Deadline extension only |
| `ACCEPTED` | Reviewer accepts | Terminal | Neither |
| `REJECTED` | Reviewer rejects, or system expires an unsubmitted milestone | Terminal | Neither |

New milestones require a future `startDate` and remain `PLANNED` after creation. The date is interpreted in the tenant time zone; `scheduledStartAt` is stored as an instant. The scheduler checks once per minute, opens the milestone and moves it to `IN_PROGRESS` in one transaction, then records an audit and outbox event. The legacy `status` and `execution_status` columns remain for compatibility. Students cannot read a planned milestone while its legacy `status` is `PLANNED`, and cannot submit before `IN_PROGRESS`. Manual start, draft, publish and open milestone commands have been removed.

`CHANGES_REQUESTED` stays in that state while the student prepares a new draft. Submitting the new version changes the milestone directly to `SUBMITTED`. Immutable `submission_versions` and `milestone_reviews` preserve V1, V2, and all review decisions. Rubric snapshot IDs and checklist definitions cannot be edited after Start. A reviewer reject records a final score of zero and emits a `MILESTONE_REJECTED` event with `severity=HIGH`.

The maximum cutoff is `deadline` for `NO_LATE`, or `lateUntil` for `ALLOW_LATE`. The scheduled job rejects an `IN_PROGRESS` milestone with no submitted attempt at that cutoff. Submission commands check the same cutoff directly, so the one-minute scheduling interval does not create an acceptance gap. A submitted version remains reviewable after the cutoff. Reviewers may request changes after the cutoff; the student can prepare a version, but the mentor/admin must extend the deadline before it can be submitted.

Every planned or active edit appends an immutable JSON snapshot in `milestone_draft_revisions`; the `milestones` row is the current working copy so existing foreign keys remain stable. Extending a deadline preserves the configured late-grace duration by moving `lateUntil` by the same amount. The revision endpoint is `GET /api/projects/{projectId}/milestones/{id}/revisions` or the team equivalent. The old `/draft-revisions` path remains an alias. Optimistic `expectedVersion` is required for edits and deletes. Audit rows record edits, submissions, reviews, deadlines and important transitions.

## API changes and dependent flows

| API / component | New behavior |
| --- | --- |
| Project, team and all-milestones GET list/detail | `lifecycleStatus` has exactly the six values above; the `lifecycleStatus` query filter uses the persisted value. Old `status` and `executionStatus` fields remain for compatibility. |
| `POST /milestones`, `PUT /{id}` for project/team | Require `startDate` (`YYYY-MM-DD`) for creation and planned edits, plus a future deadline. The start date must be after the current tenant date and its 00:00 instant must precede the deadline. Planned edits require `expectedVersion`. Responses include `startDate` and `scheduledStartAt`. |
| `PATCH /{id}` for project/team | Requires `MILESTONE_WRITE`, `expectedVersion` and a future deadline. In progress permits description plus deadline extension. Changes requested permits deadline extension only. Each success creates a revision and audit row. |
| `DELETE /{id}` for project/team | Soft deletes planned or in-progress milestones. In progress with submission records is blocked. UI asks for confirmation. |
| Artifact draft, upload, submission and workspace APIs | Submission is allowed only in `IN_PROGRESS`, or in `CHANGES_REQUESTED` for a team with a prior submission. Terminal states are read-only. The workspace returns `canSubmit`. |
| Reviewer submission list/detail, version and decision APIs | Submission status remains separate from milestone status. V1/V2 history is immutable. Review decisions advance milestone state and expose `milestoneLifecycleStatus`. |
| Risk, project alerts and backlog milestone options | Display the canonical milestone status. Risk alert eligibility applies to `IN_PROGRESS`; rejection also emits a high severity outbox event. |
| Project completion | After each acceptance, active milestones for the project/team are checked. When every one is `ACCEPTED`, the project is set to `COMPLETED` through the JPA adapter. Grade lock and waiver no longer count as acceptance. |

## Existing database

Hibernate's configured `ddl-auto=update` adds nullable `milestones.lifecycle_status`, `start_date` and `scheduled_start_at`. The startup backfill copies each old enabled schedule's exact `deadline - deadline_offset_days` instant to `scheduled_start_at` and derives `start_date` in the tenant time zone. It is safe to rerun; old milestones without an enabled schedule are left unchanged. Template-generated milestones receive a start date seven days before their deadline. For team-only workspaces, reviewer submissions can have `project_id=NULL`; the startup schema compatibility step relaxes the old `milestone_submissions.project_id` constraint on H2, MySQL/MariaDB and PostgreSQL when necessary. It does not modify existing submission rows. Back up a deployed database before the first rollout, and run the application migration on one instance before scaling out.

Legacy `CLOSED` maps to `ACCEPTED` and `CANCELLED` maps to `REJECTED`. Where a legacy review submission exists, its outcome takes precedence during backfill. Those mappings should be reviewed with owners of historical data before production rollout because the old labels did not necessarily mean a reviewer decision.
