# UFR-PRJ-001-01 — Workspace initialization delivery subtask

## Task information

- Parent scope: UFR-PRJ-001, Project Management.
- User story: US-PRJ-001-01, Initialize a workspace for an existing project/team.
- Suggested subtask title: Implement workspace initialization, access checks, shared UI and acceptance verification.
- Feature branch: feature/Project-L.
- Requested commit subject: `ufr-prj-001-01`.
- Delivery status: implementation prepared for review; final manual acceptance remains open.
- Report date: 2026-10-23, Asia/Saigon.

This report covers the work performed from requirement review through implementation and handoff. It does not claim that the complete Project Instance management UFR, or every manual acceptance case, has been completed.

## Objective and final scope

Allow an authorized mentor or team member to select an existing team and project, review current backend data, and initialize one durable workspace. Reuse the shared application layout and components, use English feature labels, and retain the project's permission model.

The delivered scope includes Workspace, Teams & Mentors and Team charter. Project Template Builder, template review/publication and creation of projects from templates were removed after the scope was clarified. Full Project Instance forms, including comprehensive metadata CRUD, are outside this workspace story.

## ST01 — Review requirements and agree the business rules

Status: implemented decisions recorded; one acceptance-text alignment remains open.

Work performed:

1. Reviewed the user story, AC01–AC13, supplied business rules, SRS references, UI illustrations and class diagram.
2. Used the illustrations to understand content structure while retaining the existing shared src design.
3. Defined the final workspace sections: Overview, Members, Milestones, Sprints, Backlog, Artifacts, Feedback and Activity.
4. Clarified that selecting or confirming a pair must not create a team, add members or write a workspace.
5. Agreed that a team may initially have no project; project assignment is saved only with successful workspace creation.
6. Enforced optional one-to-one Team–Project assignment. A project already assigned to one team cannot be selected by another.
7. Required at least one active team membership before confirmation or creation.
8. Applied the user's requested behavior: successful creation activates the project and workspace.
9. Restricted this story to selecting existing project/team data and removed the unrelated template design workflow.

Requirement alignment: the original AC07 said not to change project status. The agreed implementation activates the project on creation, so the acceptance document should be updated before final sign-off.

## ST02 — Implement the data model and persistence rules

Status: implemented.

Work performed:

1. Added tenant-aware project, cohort, team, membership and workspace persistence.
2. Connected users to tenants and checked active roles and granular permissions.
3. Added database constraints for project ownership and duplicate workspace protection.
4. Stored workspace creator, tenant and creation time.
5. Persisted eight ordered workspace sections.
6. Added durable idempotency-request, audit, outbox-event and activity records.
7. Added migration/startup handling for optional team project assignment and the project ownership constraint.
8. Preserved workspaces across refresh and application restart using the local file database.
9. Aligned legacy Planning projects that already have an Active workspace to Active.

No milestones, tasks, submissions, artifacts or feedback are generated simply because a workspace is created.

## ST03 — Implement candidate listing, selection and confirmation APIs

Status: implemented.

Work performed:

1. Added tenant- and scope-filtered candidate listing with project/team metadata, membership count, eligibility and existing workspace ID.
2. Supported cohort/status filters and pagination, including HTTP 422 for invalid page sizes.
3. Returned an empty list when no candidates match.
4. Added a project-options endpoint for an authorized team.
5. Excluded projects assigned to another team or already used by a workspace.
6. Added read-only confirmation that reloads current project/team metadata.
7. Rechecked active tenant, active user/role/permission, team membership or mentor scope, project status and the selected relationship.

Endpoints:

- GET /api/workspaces/candidates
- GET /api/workspaces/candidates/page
- GET /api/workspaces/projects?teamId={id}
- POST /api/workspaces/confirm
- POST /api/workspaces
- GET /api/workspaces/{id}

Confirm/create requests use numeric projectId and teamId from existing backend data.

## ST04 — Implement atomic creation, replay protection and error handling

Status: implemented; the reported manual concurrency result still needs investigation.

Work performed:

1. Required X-Idempotency-Key for creation.
2. Created the workspace, project assignment/status, sections and journal records in one transaction.
3. Returned HTTP 201 with the workspace ID after successful creation.
4. Replayed the saved response for the same actor/tenant/key and payload.
5. Returned HTTP 409 for a changed payload under an existing key.
6. Serialized competing creation requests using database locks and retained database uniqueness protection.
7. Returned HTTP 409 for an existing workspace, with its ID when the actor can read it.
8. Introduced a dedicated invalid-relationship exception mapped to HTTP 422, resolving the AC11 409/422 mismatch.
9. Kept mandatory saves inside the transaction so a failure rolls back the creation.
10. Recorded audit, one logical outbox event and one creation activity, with event IDs and correlation IDs.
11. Prevented repeated delivery of a logical event from generating another activity.
12. Returned HTTP 404 for retired/missing resource routes instead of a generic static-resource 500.

Manual AC10 observation: Nova has workspace 7. One captured concurrent result returned 409 with workspaceId 7, and the user also reported a 500. The complete pair of responses from one clean concurrent run and its backend failure log have not been established. This remains an acceptance follow-up; it is not recorded as resolved.

## ST05 — Integrate the English UI with the shared application template

Status: implemented.

Work performed:

1. Fixed Workspace navigation and the admin-facing route conflict that caused 404.
2. Renamed the management sidebar entry to Workspace.
3. Reused MainLayout, shared cards, tables, dialogs, form controls, badges and notifications.
4. Used English labels throughout the feature.
5. Displayed No project for unassigned teams.
6. Displayed Open workspace for existing workspaces and enabled Create workspace only for eligible rows and authorized users.
7. Replaced free-text project/team IDs with backend-driven dropdowns.
8. Added a two-step Select -> Review -> Confirm creation flow.
9. Opened Overview after successful creation and exposed the eight workspace sections.
10. Displayed existing members and mentor information.
11. Added Teams & Mentors views and mentor assignment.
12. Changed Team charter Primary channel to a dropdown.
13. Preserved list filters when cancelling confirmation.
14. Locked confirmation while a request is pending and retained the selected pair/key for a recoverable retry.
15. Removed template-builder pages, API handlers, navigation and active permissions from the final contribution.

## ST06 — Prepare focused demo data and clean test fixtures

Status: implemented.

Work performed:

1. Reduced the local demo dataset to five distinct situations.
2. Added creator and read-only demo accounts without broadening the default roles.
3. Preserved application demo changes on normal restart.
4. Added a versioned upgrade for the reserved legacy demo fixtures.
5. Separated automated test databases and fixture cleanup from the application database.
6. Provided optional manual QA setup/verification/cleanup SQL and Postman materials.

Initial demo cases:

| Team | Initial state | Expected behavior |
| --- | --- | --- |
| Atlas | No project, active members | Select an available project and create |
| Nova | Active assigned project, active members, no workspace | Create for its assigned project |
| Pixel | Existing workspace | Open the existing workspace |
| Horizon | No active members | Continue/Create remain disabled |
| Completed | Completed assigned project | Creation is rejected |

These are initial fixture states. Normal user testing consumes clean pairs; changing a key or restarting the backend does not reset them.

## ST07 — Run automated regression and build verification

Status: recorded checks passed at their execution times.

Previously recorded focused feature verification:

| Suite | Cases | Recorded result |
| --- | ---: | --- |
| WorkspaceAcceptanceIntegrationTest | 40 | Passed |
| ProjectHubIntegrationTest | 10 | Passed |
| WorkspaceDemoIntegrationTest | 5 | Passed |
| WorkspacePersistenceIntegrationTest | 1 | Passed |
| Frontend production build | 1 build | Passed |

A later selected AC08–AC12 run recorded 23 passing cases, including:

- Different-key duplicate rejection and database uniqueness.
- Durable same-key replay and changed-payload conflict.
- Two requests released together using a shared start latch.
- Exact 201/409 for different keys and identical 201 responses for the additional same-key case.
- Permission, tenant, scope, role, account, missing-target and project-status revalidation.
- Rollback at six mandatory save steps.
- Audit context and repeated logical-event delivery without duplicate activity.

Recorded browser checks covered dropdown selection, zero-member guards, removed template routes/menu, filter preservation on Cancel, pending-button locking, retry key/body retention and responsive layout. Some browser checks use isolated API fixtures; they are not a replacement for manual acceptance against the running backend.

Evidence:

- docs/workspace-acceptance/evidence/AC08-AC12-results.md
- docs/workspace-acceptance/evidence/AC10-results.md
- docs/workspace-acceptance/evidence/AC12-results.md
- docs/issues/AC11-project-team-relationship.md

These are focused feature checks. No claim is made that the entire repository test suite is green or that an automated result overrides a later manual failure report.

## ST08 — Support manual acceptance and prepare the handoff

Status: in progress; implementation can be committed for review.

Work performed:

1. Guided Postman environment setup, login, automatic token storage and candidate/project lookup.
2. Explained duplicate creation, same-key replay and changed-payload testing using actual local IDs.
3. Provided a Postman script that dispatches two creation requests before awaiting their results.
4. Distinguished an HTTP 409 duplicate result from proof of successful concurrency handling.
5. Explained the need for a clean pair before each concurrency run and the need for database evidence.
6. Guided the AC11 401/403/404/422/409 cases and use of the read-only viewer token.
7. Clarified that No Auth is not a complete expired-session test and a viewer account is not proof of permission revocation after confirmation.
8. Explained Activity checks through the workspace detail endpoint.
9. Clarified that the public API does not expose transaction-failure injection or logical-event redelivery controls.
10. Prepared the UI verification approach for Cancel, pending locks and recoverable retry.
11. Prepared this subtask report and instructions for committing and pushing the feature branch.

### Remaining acceptance work

- [ ] Investigate the user-reported AC10 500; retain both responses from the same concurrent run.
- [ ] Repeat AC10 on a fresh pair and verify exactly one database workspace.
- [ ] Collect complete manual AC11 evidence, including applicable changes after a successful confirmation.
- [ ] Attach AC12 backend fault-injection/audit/redelivery evidence; Activity-only Postman screenshots do not complete AC12.
- [ ] Complete manual AC13 checks on a fresh eligible pair: Cancel preserves filters/no writes, pending submit is locked, retry retains the pair/body/key.
- [ ] Align the original AC07 wording with the agreed project activation behavior.
- [ ] Obtain final acceptance before marking the parent story Done.

### Handoff instructions

1. Review the source and documentation changes on feature/Project-L.
2. Stage the backend, frontend source and documentation belonging to this contribution.
3. Keep the local partition-2.jsonl file out of the feature commit.
4. The current frontend/package-lock.json changes are peer metadata only, with no dependency/version change; they are not needed for this contribution.
5. Review application configuration before publishing, especially any credential defaults already present in the shared repository.
6. Commit using exactly ufr-prj-001-01.
7. Push feature/Project-L to origin and retain the commit ID.
8. Keep acceptance follow-ups visible in the review/task description.

Suggested review summary:

Implement tenant-scoped workspace selection and atomic initialization for existing one-to-one project/team relationships. Add the shared English Workspace/Teams UI, durable idempotency, audit/activity/outbox records, focused fixtures and acceptance tests. Final manual acceptance remains pending, including the reported AC10 500 and the outstanding AC11–AC13 evidence.

