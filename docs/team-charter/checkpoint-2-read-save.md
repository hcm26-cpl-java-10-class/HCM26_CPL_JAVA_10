# Team Charter — checkpoint 2: scoped read and versioned save

> Historical checkpoint only. The completed implementation and final verification are documented in `README.md` and `acceptance-verification.md`; they supersede the partial scope and results below.

Implementation branch: `feature/team-charter`  
Base: `1429b4def`  
Scope: the read/save foundation of UFR-PEO-013-01 and UFR-PEO-013-02; not the complete six-story feature.

## Implemented behavior

- Current content stays in the existing five `project_teams` fields. Added `charter_revision` is a business counter; `ProjectTeam.version` remains the shared technical optimistic-lock token.
- `GET /api/project-hub/teams/{id}/charter` returns team identity/status, business revision, read-only/edit capability and charter content including `version`.
- Read permission accepts existing `TEAM_READ`, `WORKSPACE_READ` or `VIEW_PROJECT_WORKSPACE`, combined with active tenant, active class/team record and the existing object-scope specification. This does not grant any new permissions to students.
- `PUT /api/project-hub/teams/{id}/charter` keeps its existing route and TeamView response. Editing requires `TEAM_UPDATE`, object scope and an ACTIVE team. ARCHIVED teams can be read in scope but cannot be edited. DRAFT is not opened up by this change.
- Every PUT must include the version read from the server. Missing/negative version is 422; stale version or an optimistic-lock race is 409. The existing form is updated to send this token. A legacy client omitting it now fails explicitly rather than bypassing overwrite protection.
- Partial content can be saved. Existing limits remain 2,000 characters for mission/definition of done/conflict resolution and 255 for channel/core hours. These are UTF-16 units, matching HTML maxLength, Bean Validation @Size and Java String.length. Input is never truncated server-side.
- Line endings and surrounding whitespace are normalized. `Teams` is mapped to `Microsoft Teams`. Existing non-standard channel values remain readable and may be retained unchanged; new unsupported values are rejected.
- A meaningful save increments the business revision and writes an immutable content snapshot, audit record and outbox record in the same transaction. A no-op does not increment either revision/version or create duplicate evidence. A stale no-op is still rejected.
- Revision snapshots contain saved content, actor, server timestamp and correlation ID. They are content evidence, **not member consent**. The outbox relay is the project's existing logging relay; this change does not claim an external delivery or notification guarantee.
- The form preserves edits on validation/conflict/network error, disables pending/repeated saves, and only replaces local edits after a successful save or an explicit “Reload saved charter (replace edits)” action. Loading, retry and server read-only capability are handled.

## Regression fixes found while establishing the baseline

1. Project Hub integration fixtures now create `ProjectTeam` / `ClassMember` / `ProjectMember` rather than the retired Team/TeamMember model.
2. The menu-cleanup test now verifies the retired menu is hidden while a shared template permission remains active, matching current production behavior.
3. Workspace candidate queries had been reduced to tenant-only filtering. Reapplied `WorkspaceCandidateSpec.forScope` to both candidate list and page queries; membership/staff/assigned mentor/data-scope rules and tenant boundaries stay centralized. No permissions are added. A student must not see an unrelated team's candidate solely because it belongs to the same tenant.
4. The persistence regression checks the current nine Workspace sections, including Resources, and verifies Charter content/revision survives restart.

## Database compatibility

New entity/table: `TeamCharterRevision` / `team_charter_revisions` (unique team/revision, no cascading deletion). Existing charter values are preserved. Legacy teams start at business revision 0; this is not confirmation or acceptance. First meaningful edit creates revision 1, with prior values retained in the audit before-state.

For deployments using `validate`/`none`, review and apply `backend/src/main/resources/db/manual/team-charter.sql` once before deployment. It is MySQL 8 DDL and has **not** been executed against the group's database. Hibernate test schema creation and file-H2 restart were tested; real MySQL migration remains a deployment check. No real/demo database or default connection configuration was altered during this checkpoint.

## Verification

- Backend suites: `ProjectHubIntegrationTest`, `ProjectTeamRoleServiceTest`, `WorkspacePersistenceIntegrationTest`.
- Final results: **23/23 Project Hub API tests, 4/4 role-service tests and 1/1 persistence/restart test passed (28 total)**. The Project Hub suite was rerun after adding the Mentor scope scenario; the other two suites passed in the preceding combined run against unchanged production backend code.
- API coverage includes Admin/member/Mentor access, unrelated-team and foreign-tenant denial, inactive class, inactive tenant, ARCHIVED read-only behavior, required version, all five length limits, incomplete drafts, channel validation, meaningful saves, no-op, stale writes, immutable prior content, audit/outbox evidence, rollback and two concurrent writers with exactly one 200 and one 409.
- Frontend: production build and ESLint for the four changed TS/TSX files. Bundle-size warnings pre-exist.
- Chromium checks use the actual `TeamCharterForm` with mocked API requests: loading saved values, version payload, pending duplicate prevention, conflict input retention, focus retention, explicit reload, refreshed-version save, browser character limit, server read-only capability and GET error/retry. Checked overflow and screenshots at 1440×900, 1366×768 and 390×844.
- Temporary browser harness files are removed. Logs, screenshots and the browser script remain in the OS temporary directory `hoa-team-charter-baseline`, outside application source.

## Current UI entry limitation and next checkpoint

The group currently redirects `/management/project-teams` to `/management/workspaces/candidates`; `TeamsMentorsPage` is not a reachable production entry. Its existing Charter form invocation was corrected to pass edit capability, but the new student/Workspace entry is deliberately deferred to the UI checkpoint. Do not claim a new menu/page is already available in the original running application.

For contract review in an isolated backend running this branch, use Swagger for the GET/PUT endpoints above. Read `charter.version`, then send that exact value in the PUT. A stale PUT should return 409 while leaving the saved content intact. Never point such a trial at the shared or original demo database without deliberately selecting a test database.

Deploy the updated backend, schema and frontend together: an old frontend sending no version will receive 422 until refreshed. This explicit rejection is intentional overwrite protection, not transparent backward compatibility with unversioned writes.

Next: self-confirmation, immutable consent tied to revisions, roster/role-change handling, progress and history. Preview and the complete student Workspace screen follow those backend invariants. No Sprint gate, automatic role assignment, notification service, commit, push or PR is introduced by this checkpoint.
