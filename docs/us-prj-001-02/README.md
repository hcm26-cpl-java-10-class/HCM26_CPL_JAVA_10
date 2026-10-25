# US-PRJ-001-02 — Workspace overview and members

Updated 2026-10-24. The UI is in English and reuses the shared application layout/components.

## Start here

Read MANUAL_TEST_AC01_AC10.md for the Vietnamese step-by-step acceptance guide, expected results, evidence screenshots and cleanup.

Import US02_STANDARD_ACCOUNTS.postman_collection.json into Postman. It has 13 requests using the existing accounts, automatically captures tokens/IDs, and checks the real read API. Run it on the initial Team Pixel fixture before changing roster/permissions. It does not create a workspace.

| Existing account | Workspace access |
| --- | --- |
| admin@example.com | Full permissions within the tenant |
| teacher@example.com | Read/create workspace, read members, manage team memberships within assigned scope |
| student@example.com | Read Overview and members of teams where membership is ACTIVE; no creation or team writes |

Use the existing password (seed default password123). Restart the backend after taking the code and log in again to refresh frontend permissions.

Project Management now contains only Workspace. The former /management/project-teams UI redirects to Workspace. The page/breadcrumb says Workspace; Create workspace remains the creation action. Edit memberships at Open workspace → Members → Manage members.

## Membership management

A permitted manager can add an existing active user, choose a project role and set participation ACTIVE/INACTIVE/LEFT. Memberships are reused rather than duplicated; LEFT records and historical workspace activity are retained. Closing Manage members refreshes Overview; the separate member list refreshes after saves.

Project roles are independent of system roles. The default project role is UNASSIGNED; selecting TEAM_LEADER does not grant system ADMIN rights.

The Team Management write API is:
- GET /api/project-hub/teams/{teamId}/members
- GET /api/project-hub/teams/{teamId}/member-options
- PUT /api/project-hub/teams/{teamId}/members/{userId}

It requires WORKSPACE_READ, WORKSPACE_MEMBER_READ and TEAM_UPDATE, plus an active tenant and valid team scope. Updates validate tenant membership, account eligibility and project-role/status enums on the backend.

Workspace GET endpoints remain read-only. GET /api/workspaces/{id}/members still returns only user_code, display_name, project_role, status. Overview returns member_count without embedding the roster.

## Local fixtures

WorkspaceDemoDataService now reuses the existing accounts. Pixel has student as a member and teacher as mentor; Nova has admin as a member and teacher as mentor. Atlas has student and no project; Horizon is empty; Completed has a completed project. Existing IDs/assignments and roster edits are preserved.

Old workspace.*.demo accounts/roles are no longer created. Existing reserved accounts are disabled/locked; their old memberships are retained as inactive LEFT records and sample-team mentors/missing replacement relationships are migrated. Activity actor history is preserved.

Seed runs only on local H2 outside the test profile and can be disabled with app.workspace.demo.enabled=false. It adds snapshots only when missing.

The former demo-h2.sql has been replaced with read-only standard-accounts.sql. The acceptance guide links AC02 source-version simulation and AC07 setup/restore SQL. Those scripts are local test fixtures; the application does not run them automatically.

## Ownership and verification

Curriculum owns snapshot capture; Workspace reads its fixed project-specific snapshot. There is no template designer in this feature. TeamMembershipService owns explicit roster writes independently of workspace viewing.

See VERIFICATION.md for executed backend/frontend/live checks. IMPLEMENTATION_GUIDE.md describes the initial architecture; current source and MANUAL_TEST_AC01_AC10.md take precedence over its original code examples.

