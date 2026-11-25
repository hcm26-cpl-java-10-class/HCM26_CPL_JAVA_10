# US-PRJ-001-02 verification

Updated 2026-10-24 (Asia/Saigon).

## Final recorded backend results

| Suite | Tests | Failures | Errors |
| --- | ---: | ---: | ---: |
| WorkspaceOverviewIntegrationTest | 14 | 0 | 0 |
| WorkspaceAcceptanceIntegrationTest | 40 | 0 | 0 |
| ProjectHubIntegrationTest | 10 | 0 | 0 |
| WorkspaceDemoIntegrationTest | 8 | 0 | 0 |
| WorkspacePersistenceIntegrationTest | 1 | 0 | 0 |
| TeamMembershipIntegrationTest | 6 | 0 | 0 |
| Total | 79 | 0 | 0 |

Executed with JDK 21 and offline Maven. The initial combined run found two test-fixture problems (a legacy account assertion expected deletion rather than deactivation; a foreign test user lacked required firstName). Those fixtures were corrected and the affected suites rerun. The final table reflects each suite's latest result, not a single final combined invocation.

New coverage includes real admin/teacher/student permissions; scoped project-role assignment; student write denial; ACTIVE/LEFT refresh, membership reuse and history retention; cross-tenant/invalid-role rejection; idempotent fixture migration with old account deactivation; preservation of existing roster edits; and execution/restore of the supplied local AC02/AC07 SQL.

The existing snapshot/privacy/authorization/read-only tests and workspace creation regressions remain passing. Tests use isolated H2 databases.

## Frontend

npm.cmd run build passed after the final routing/layout changes. No dependencies were added. Vite reports the existing non-blocking chunk-size warning.

The initial implementation was checked with nine deterministic browser scenarios using controlled API responses for loading/error/empty/permission/switching states. The earlier login 404 regression was also reproduced and fixed: workspace-only accounts were redirected to a Dashboard menu requiring USER_READ. Shared home navigation now considers effective permissions.

## Live checks after the standard-account change

Used the running frontend at localhost:5173 and backend at localhost:8080 with the existing file database:

- Executed all 13 requests and their assertion scripts from the supplied Postman Collection through a local Node harness: admin/teacher/student login; dynamic Pixel IDs; Overview and member data; exact four fields; privacy checks; manager roster; student management denial 403; missing ID 404; invalid JWT 401; repeated snapshot consistency. All passed. This validates the exported scripts against actual responses; the Postman desktop Runner itself was not driven.
- Logged in through the actual teacher/student/admin UI.
- Teacher changed student's project role via the live dropdown; member display refreshed.
- Student saw the updated role, had no Manage members control, could not create a workspace, and a direct membership PUT returned 403.
- Teacher changed student participation to LEFT; active member list/count became empty/zero without changing workspace ID or history.
- Restored original project role/status in cleanup.
- Project Management exposes Workspace; the former team UI URL redirects to Workspace.
- Management dialog checked on desktop and at 390 px width; no page overflow or browser runtime errors.

Browser scripts/screenshots are in the conversation's visualization directory. No workspace reset or deletion was performed against the running application. The startup fixture migration disables old demo logins and preserves their history.

## Limits of evidence

The Collection's repeated snapshot check alone does not simulate a real Curriculum update. The supplied local source fixture demonstrates independence from a newer mock source; full integration acceptance needs the Curriculum owner's update API when available.

No assessment draft-score/feedback workflow exists in this module. Privacy DTO tests prove the current Workspace responses omit those fields; integration with real unpublished assessment data remains a future system-level check.

The earlier manual AC10 500 from US-PRJ-001-01 is not declared fixed by these checks. Manual acceptance of all UI/precondition cases still follows MANUAL_TEST_AC01_AC10.md.

