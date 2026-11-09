# US-PRJ-001-02 — Workspace overview and members

Updated 2026-10-30. The UI is in English and reuses the shared application layout/components.

## Start here

Read MANUAL_TEST_AC01_AC10.md for the Vietnamese step-by-step acceptance guide, expected results, evidence screenshots and cleanup.

Import US02_STANDARD_ACCOUNTS.postman_collection.json into Postman. It has 13 requests using the existing accounts, automatically captures tokens/IDs, and checks the real read API. Run it on the initial Team Pixel fixture before changing roster/permissions. It does not create a workspace.

| Existing account | Workspace access |
| --- | --- |
| admin@example.com | Full permissions within the tenant |
| teacher@example.com | Read/create workspace and read members within assigned scope |
| student@example.com | Read Overview and members of teams where membership is ACTIVE; no creation or team writes |

Use the existing password (seed default password123). Restart the backend after taking the code and log in again to refresh frontend permissions.

Project Management now contains only Workspace. The former /management/project-teams UI redirects to Workspace. The page/breadcrumb says Workspace; Create workspace remains the creation action. Manage team membership and roles in Project Team Allocation.

## Membership ownership

Project Team Allocation owns team membership and role writes. Workspace Members displays the member code, name and allocation roles, including multiple roles per member. Search works within the loaded roster. Managers can open the matching team in Project Team Allocation. The former Project Hub member-management endpoints have been removed.

GET /api/workspaces/{id}/members returns `user_code`, `display_name` and `roles` (an array of PM/BA/DEV/QA codes) for active allocation members of the workspace team. Overview returns `member_count` from the same roster without embedding member details. Reading members still requires WORKSPACE_MEMBER_READ and workspace scope.

## Local fixtures

WorkspaceDemoDataService now reuses the existing accounts. Pixel has student as a member and teacher as mentor; Nova has admin as a member and teacher as mentor. Atlas has student and no project; Horizon is empty; Completed has a completed project. Existing IDs/assignments and roster edits are preserved.

Old workspace.*.demo accounts/roles are no longer created. Existing reserved accounts are disabled/locked; their old memberships are retained as inactive LEFT records and sample-team mentors/missing replacement relationships are migrated. Activity actor history is preserved.

Seed runs only on local H2 outside the test profile and can be disabled with app.workspace.demo.enabled=false. It adds snapshots only when missing.

The former demo-h2.sql has been replaced with read-only standard-accounts.sql. The acceptance guide links AC02 source-version simulation and AC07 setup/restore SQL. Those scripts are local test fixtures; the application does not run them automatically.

## Ownership and verification

Curriculum owns snapshot capture; Workspace reads its fixed project-specific snapshot. There is no template designer in this feature. Project Team Allocation owns roster and role writes; Workspace only reads the resulting roster.

See VERIFICATION.md for executed backend/frontend/live checks. IMPLEMENTATION_GUIDE.md describes the initial architecture; current source and MANUAL_TEST_AC01_AC10.md take precedence over its original code examples.

