# Team Charter — implementation checkpoints

Owner: Tran Trong Hoa (DEV 4)  
Requirement: UFR-PEO-013  
Working specification: User Stories v1.1 (six stories, 51 acceptance criteria)  
Baseline: `1429b4defc8881c00396f7774ac8e3a4fe5ccc2e` (`origin/feature/project`, fetched 16 November 2026)

## Checkpoint 1: isolated baseline

Implementation branch: `feature/team-charter`. The original working directory remains on its existing Artifact branch; pending Artifact, question migration, test and IntelliJ files are preserved there. No application configuration, database or seed data is changed at this checkpoint.

The separate worktree uses the existing frontend dependencies through a local directory junction. This is local tooling, not a tracked project dependency or a deployment requirement. The containing repository locally excludes `.worktrees/` to prevent thousands of unrelated files appearing as pending changes.

## Verified gaps in the baseline

- `ProjectTeam` already stores the five charter fields. Its technical optimistic-lock version is not a charter revision number.
- `ProjectHubController` has a charter PUT endpoint; there are no dedicated charter confirmation or revision-history endpoints.
- `TeamCharterForm` currently supports saving fields, but not Preview, self-confirmation or revision history.
- `ProjectMember` refers to `ClassMember`, which refers to `User`. `leaderMemberId` identifies a ClassMember; the Project Hub member DTO identifies a User. These identities must not be compared interchangeably.
- Official project roles are PM, BA, DEV and QA, including existing multi-role support. Do not add a competing role-assignment system in Charter.
- Existing charter writes use TEAM_UPDATE. Do not grant that broad permission to all students to enable confirmation.

## Implementation assumptions for the next checkpoint

These are proposed implementation policies derived from the working specification, not claims that every detail appears verbatim in the original SRS. Review them at the user checkpoint before implementing dependent behavior.

| Area | Proposed behavior |
| --- | --- |
| Ownership | One charter per Team, shared by workspaces of that Team; no sharing across different Teams. |
| Permissions | Read, edit and self-confirm are separate capabilities, enforced server-side with tenant and object scope. Reuse project authorization conventions. |
| Confirmation | Only the authenticated member confirms for themselves. Mentor, Admin and Leader cannot confirm for another student. |
| Save versus confirm | Save may preserve incomplete content. Confirmation requires the current saved content and valid role/responsibility information. |
| Revisions | A meaningful content, roster or role change requires renewed confirmation. Repeated saves without meaningful changes do not create revisions or reset consent. |
| Concurrency | Explicit expected-version checks; stale requests return 409 without discarding the user's draft input. Keep technical version distinct from business revision. |
| Retries | Duplicate confirmation requests must not duplicate consent, audit effects or logical events. |
| History | Preserve the saved content and member/role evidence for each confirmed revision; membership removal must not erase that evidence. |
| Limits | Mission, definition of done and conflict resolution: 2,000 characters each. Channel and core hours: 255 characters, matching the existing model. |
| Team lifecycle | ACTIVE permits authorized writes. ARCHIVED is read-only within permitted scope. Do not extend DRAFT access globally without checking Allocation rules. |
| Sprint lifecycle | Full charter confirmation does not automatically start a Sprint or introduce a new Start Sprint gate. |
| Responsibilities | Inspect the official role/template source first. Missing responsibility data must be explicit; do not invent individual responsibilities from role labels. |
| Existing data | Preserve existing charter fields, do not invent legacy consent. Decide and document the current-state source and compatibility of the legacy PUT before adding persistence. |
| UI | English labels, existing RBAC typography/components, two responsive columns, keyboard-accessible Preview and clear read-only/pending/confirmed states. |

## Delivery checkpoints

1. **Baseline and decisions:** preserve pending work, isolate branch, check existing tests/build and document gaps.
2. **Read/save contract and persistence:** source of truth, schema evolution compatible with existing deployment, scoped DTOs, validation, concurrency and atomic audit/event behavior.
3. **Confirmation and revision integrity:** self-confirm, deduplication, immutable snapshots, role/roster changes, history and accurate progress.
4. **Student UI and Workspace integration:** form, Preview, confirmation list, history, errors and stable input during refresh.
5. **Mentor visibility and acceptance:** progress integration, cross-team/tenant denial, concurrency and regression checks, demo instructions.

After each checkpoint, run meaningful tests for the work completed, report the tested routes/actions and remaining limits, and pause for the user's review before continuing.

## Baseline verification scope

Backend: `ProjectHubIntegrationTest` (test profile with in-memory H2) and `ProjectTeamRoleServiceTest` (Mockito). Neither is evidence that new charter features are implemented. Frontend: production build and lint on the current Charter form and Teams/Mentors page.

Results are recorded after execution; a successful compile alone does not prove browser behavior or all 51 acceptance criteria. New UI and database changes are deferred to later checkpoints.

### Executed results — checkpoint 1

| Check | Result |
| --- | --- |
| Frontend production build (`npm run build`) | Passed. Existing bundle-size warning remains. Sandbox initially blocked esbuild process creation; rerun outside that restriction passed. |
| ESLint: `TeamCharterForm.tsx`, `TeamsMentorsPage.tsx` | Passed. This is scoped lint, not a claim that repository-wide lint passes. |
| `ProjectTeamRoleServiceTest` | 4 tests passed. |
| `ProjectHubIntegrationTest` | 10 tests executed: 3 passed, 7 failed, 0 errors. |
| Original pending files | SHA-256 verification: all six files unchanged from the safety snapshot. |
| Browser / new charter acceptance | Not tested: no new UI, endpoints or database features implemented at this checkpoint. |

The integration baseline is **not green**. Six failed scenarios use legacy Team/TeamMember fixtures while current Project Hub/Workspace lookup uses ProjectTeam and ProjectMember from Team Allocation; the resulting assertions include missing list rows and unexpected 404 responses. A seventh scenario expects legacy template menu/permission cleanup that is no longer reflected by the current baseline. Do not change production authorization to accommodate outdated fixtures. The next checkpoint must establish fixtures for the canonical model and separately investigate the menu expectation, then test the actual charter contract before feature work is reported as passing.

No commit, push, default launch configuration change, demo database migration or seed operation was performed. Test logs and copies of the six pending files are stored outside the application repository in the local temporary directory `hoa-team-charter-baseline`.

## Checkpoint 2 completed

See [scoped read/save report](checkpoint-2-read-save.md). The read/save foundation now has explicit version protection, append-only saved-content snapshots and transactional audit/outbox. Final targeted verification: 28 backend tests passed, production frontend build/scoped lint passed, and mock-request browser checks passed at desktop/mobile widths. This is not a claim that confirmation, history UI or the new student route is complete.
