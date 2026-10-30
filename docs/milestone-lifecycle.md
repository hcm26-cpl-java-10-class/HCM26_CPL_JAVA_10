# Milestone lifecycle (six states)

`milestones.lifecycle_status` is the business state. `status` and `execution_status` remain as compatibility columns for old clients. All milestone list/detail/create responses and filters use `lifecycleStatus`; reviewers also receive `milestoneLifecycleStatus` on submission responses. A startup backfill derives the new value from existing submission and milestone rows. It keeps historical submission versions and reviews unchanged.

| State | Entry | Allowed next state | Edit/delete |
| --- | --- | --- | --- |
| `PLANNED` | Created or published, before the scheduled opening | `IN_PROGRESS` automatically at `deadline - deadlineOffsetDays` | Full draft edit; delete while no submission; publish validates fields |
| `IN_PROGRESS` | Scheduled opening | `SUBMITTED` on student submit; `REJECTED` after the maximum submission cutoff without a submission | Description and extension of deadline; delete only without submission records, with UI warning |
| `SUBMITTED` | Student submits V1 or a later version | `ACCEPTED`, `CHANGES_REQUESTED`, `REJECTED` through reviewer decision | Neither |
| `CHANGES_REQUESTED` | Reviewer requests changes with feedback | `SUBMITTED` only when a new version is submitted | Deadline extension only |
| `ACCEPTED` | Reviewer accepts | Terminal | Neither |
| `REJECTED` | Reviewer rejects, or system expires an unsubmitted milestone | Terminal | Neither |

The two old `PLANNED` phases remain distinguishable in the compatibility `status` column: `PLANNED` is an unpublished working draft, while `OPEN` with `TODO` means published but not started. Students cannot read unpublished rows. They can see a published planned milestone but cannot submit until its scheduled opening. A complete create request with `deadlineOffsetDays` enables automatic start; an explicit draft must first be published. The UI defaults this field to 7 days. Existing API clients that omit it retain manual `/open` and `/start` behavior. The scheduler checks once per minute and records an audit and outbox event. There is no separate `PUBLISHED` business state.

`CHANGES_REQUESTED` stays in that state while the student prepares a new draft. Submitting the new version changes the milestone directly to `SUBMITTED`. Immutable `submission_versions` and `milestone_reviews` preserve V1, V2, and all review decisions. Rubric snapshot IDs and checklist definitions cannot be edited after Start. A reviewer reject records a final score of zero and emits a `MILESTONE_REJECTED` event with `severity=HIGH`.

The maximum cutoff is `deadline` for `NO_LATE`, or `lateUntil` for `ALLOW_LATE`. The scheduled job rejects an `IN_PROGRESS` milestone with no submitted attempt at that cutoff. Submission commands check the same cutoff directly, so the one-minute scheduling interval does not create an acceptance gap. A submitted version remains reviewable after the cutoff. Reviewers may request changes after the cutoff; the student can prepare a version, but the mentor/admin must extend the deadline before it can be submitted.

Every planned or active edit appends an immutable JSON snapshot in `milestone_draft_revisions`; the `milestones` row is the current working copy so existing foreign keys remain stable. Extending a deadline preserves the configured late-grace duration by moving `lateUntil` by the same amount. The revision endpoint is `GET /api/projects/{projectId}/milestones/{id}/revisions` or the team equivalent. The old `/draft-revisions` path remains an alias. Optimistic `expectedVersion` is required for edits and deletes. Audit rows record edits, submissions, reviews, deadlines and important transitions.

## API changes and dependent flows

| API / component | New behavior |
| --- | --- |
| Project, team and all-milestones GET list/detail | `lifecycleStatus` has exactly the six values above; the `lifecycleStatus` query filter uses the persisted value. Old `status` and `executionStatus` fields remain for compatibility. |
| `POST /drafts`, `PUT /{id}/draft`, `POST /{id}/publish`, `POST /milestones` | Accept `deadlineOffsetDays` (0–365). A draft is not scheduled until published; a complete create is scheduled immediately. The legacy `status` still distinguishes unpublished and published planned milestones. |
| `PATCH /{id}` for project/team | Requires `MILESTONE_WRITE`, `expectedVersion` and a future deadline. In progress permits description plus deadline extension. Changes requested permits deadline extension only. Each success creates a revision and audit row. |
| `DELETE /{id}` for project/team | Soft deletes planned or in-progress milestones. In progress with submission records is blocked. UI asks for confirmation. |
| Artifact draft, upload, submission and workspace APIs | Submission is allowed only in `IN_PROGRESS`, or in `CHANGES_REQUESTED` for a team with a prior submission. Terminal states are read-only. The workspace returns `canSubmit`. |
| Reviewer submission list/detail, version and decision APIs | Submission status remains separate from milestone status. V1/V2 history is immutable. Review decisions advance milestone state and expose `milestoneLifecycleStatus`. |
| Risk, project alerts and backlog milestone options | Display the canonical milestone status. Risk alert eligibility applies to `IN_PROGRESS`; rejection also emits a high severity outbox event. |
| Project completion | After each acceptance, active milestones for the project/team are checked. When every one is `ACCEPTED`, the project is set to `COMPLETED` through the JPA adapter. Grade lock and waiver no longer count as acceptance. |

## Existing database

Hibernate's configured `ddl-auto=update` adds nullable `milestones.lifecycle_status` and the startup backfill fills existing rows. For team-only workspaces, reviewer submissions can have `project_id=NULL`; the startup schema compatibility step relaxes the old `milestone_submissions.project_id` constraint on H2, MySQL/MariaDB and PostgreSQL when necessary. It does not modify existing submission rows. Back up a deployed database before the first rollout, and run the application migration on one instance before scaling out.

Legacy `CLOSED` maps to `ACCEPTED` and `CANCELLED` maps to `REJECTED`. Where a legacy review submission exists, its outcome takes precedence during backfill. Those mappings should be reviewed with owners of historical data before production rollout because the old labels did not necessarily mean a reviewer decision.
