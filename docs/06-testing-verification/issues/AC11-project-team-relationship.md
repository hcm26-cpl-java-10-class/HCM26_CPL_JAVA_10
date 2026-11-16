# API returns HTTP 409 instead of HTTP 422 on Project-Team invalid relationship (AC11 Mismatch)

Status: Resolved.

## Requirement

AC11 requires HTTP 422 when the selected project/team relationship is invalid. AC08 and AC10 require HTTP 409 for a duplicate workspace. AC09 requires HTTP 409 when an idempotency key is reused with a different payload.

## Reproduction

1. Sign in as a mentor with workspace create permission.
2. Choose an unassigned team with active members and no workspace.
3. Select the project already assigned to another team, even if that project has no workspace.
4. Submit that pair to POST /api/workspaces/confirm or POST /api/workspaces with a fresh X-Idempotency-Key.

Expected: HTTP 422; no project assignment, workspace, audit, activity, outbox event or request record is created.

Previous behavior: HTTP 409 from the shared conflict exception.

## Resolution

WorkspaceRelationshipException has a dedicated HTTP 422 controller handler. Both invalid relationship directions use it: a team selecting a different project's ID, and a project being selected by a different team. Duplicate workspace and idempotency conflict handling remain HTTP 409.

## Regression coverage

WorkspaceAcceptanceIntegrationTest verifies both endpoints reject invalid pairs with 422 and preserve creation counts. It separately checks 409 duplicate requests, durable idempotency replay, and concurrent requests for the same valid pair.

Verification: 40 workspace acceptance tests, 10 project/team API tests, 5 demo-data tests and 1 restart/persistence test passed. Frontend production build passed. Browser checks passed for removed builder routes/menu, existing-project dropdowns, empty-team guards, Cancel with filters, pending-button locking, retry key/body retention and mobile layout.
