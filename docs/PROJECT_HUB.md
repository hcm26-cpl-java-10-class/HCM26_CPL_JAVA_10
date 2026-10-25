# Project Hub — Workspace

Scope: initialize a workspace for an existing project/team, with Teams & Mentors and Team charter. Project Template Builder, template review/publication, and automatic project creation from templates have been removed from this contribution. UFR-PRJ-001 Project Instance forms are a separate requirement from this workspace story.

All feature UI text is in English and uses the shared src layout/components.

## Run

Backend, from backend with JDK 21:

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
& "C:\Program Files\apache-maven-3.9.16\bin\mvn.cmd" spring-boot:run
```

Frontend, from frontend:

```powershell
npm.cmd run dev
```

Workspace: http://localhost:5173/management/workspaces/candidates

Teams & Mentors: http://localhost:5173/management/project-teams

Rebuild/restart the backend after this change to unload removed classes and disable previously generated template menus and permissions. Existing project/team/workspace records are retained.

## Local demo data

The local H2 application seeds five demo teams. Dataset version 2 replaces the older reserved WS-DEMO fixtures once, then preserves changes on later restarts. All data outside the reserved demo fixture records is preserved.

| Team | Project | Active memberships | Initial action |
| --- | --- | --- | --- |
| Atlas | No project | 3 | Select the free Campus Service Portal project, then Create workspace |
| Nova | Learning Resource Hub, Active | 3 | Create workspace for its assigned project |
| Pixel | Student Support Portal, Active | 3 | Open workspace |
| Horizon | No project | 0 | Creation and Continue disabled even after selecting a project |
| Completed | Completed Project | 2 | Creation disabled |

Demo mentor: workspace.mentor.demo@example.com / password123.

Demo viewer: workspace.viewer.demo@example.com / password123. This account can read its member teams but cannot create.

The default admin is admin@example.com / password123 unless seed configuration overrides it. Demo roles do not change default Teacher/Student permissions.

Fixtures are enabled only for local H2 outside the test profile; WORKSPACE_DEMO_ENABLED=false disables them.

## Creation rules

- Team–Project is optional one-to-one, enforced by a unique constraint on teams.project_id.
- A project assigned to another team is excluded even when no workspace exists.
- A team with a project can select only that project. An unassigned team can select a free project.
- At least one active team membership is required. Both confirmation and creation recheck this condition.
- Selecting/reviewing writes nothing. Confirmation of creation assigns the project, activates project/workspace, and saves eight ordered sections.
- Empty sections contain no generated milestones, tasks, submissions, artifacts or feedback.
- The project must be Planning or Active; Completed, Cancelled and Draft projects cannot start.
- Existing Planning projects with an Active workspace are aligned to Active at backend startup.

## API

| Endpoint | Behavior |
| --- | --- |
| GET /api/workspaces/candidates | Tenant/scope-filtered rows, eligibility and existing workspace ID |
| GET /api/workspaces/candidates/page | Filter-aware paging; size 1–100; invalid size returns 422 |
| GET /api/workspaces/projects?teamId={id} | Available existing projects for the authorized team |
| POST /api/workspaces/confirm | Reload current metadata; no writes |
| POST /api/workspaces | Create atomically; requires X-Idempotency-Key |
| GET /api/workspaces/{id} | Details, members, charter, sections and persisted activity |

Confirm/Create body:

```json
{ "projectId": 123, "teamId": 456 }
```

Use IDs returned by the API. Both fields are required and positive.

Permissions: WORKSPACE_READ / VIEW_PROJECT_WORKSPACE and WORKSPACE_CREATE / CREATE_PROJECT_WORKSPACE. TEAM_UPDATE controls mentor/charter edits. Primary channel is a dropdown.

## Acceptance tests AC08–AC13

Step-by-step evidence collection, an importable Postman collection, concurrent request script, isolated H2 fixtures and report commands are in [workspace-acceptance/README.md](workspace-acceptance/README.md). The most recent integration evidence is exported separately; running the Postman collection is a manual HTTP verification step.

| AC | Procedure | Expected result |
| --- | --- | --- |
| AC08 | Submit an already-created pair with a different key | 409, existing workspaceId if readable, no additional records |
| AC09 | Create, then retry identical key/body; then reuse key with a different valid body | Same 201 response/id for replay; changed body gives 409; one audit/event/activity |
| AC10 | Start two threads together for the same clean pair with different keys | Exactly 201 + 409; one workspace, audit, outbox event and activity |
| AC11 | Change permissions/scope/status or supply an invalid relationship | 401 expired session; 403 revoked access; 404 missing target; 422 invalid relationship; 409 Completed/Cancelled status |
| AC12 | Inject failure at a mandatory save step; then retry after removing the fault | Full rollback including assignment/status, no partial workspace; retry succeeds; repeated event delivery gives one activity |
| AC13 | Cancel a reviewed selection with list filters; simulate a pending request and a recoverable error | No writes on Cancel; filters preserved; submit locked while pending; selection/key retained for retry |

Invalid relationship and duplicate workspace are distinct: both directions of a Project–Team mismatch return 422. A simultaneous loser for the *same valid pair* returns 409. The bug is recorded in issues/AC11-project-team-relationship.md.

WorkspaceAcceptanceIntegrationTest creates a new tenant, actor, project, team and active membership before every case. It asserts the pair has zero workspaces and the actor has zero creation-request records. After each case it deletes only that test tenant's workspace sections, requests, audit, outbox, activity and workspaces. The application demo data is not used or reset by these tests.

AC10 uses two executor threads, a ready latch and a shared start latch. Both HTTP requests are released before either result is awaited. Different keys must produce exactly 201/409; the same-key variant produces two identical 201 responses. Database counts are asserted after both finish. Matching timestamps to a particular millisecond is not required.

For Postman, use a clean pair for AC09 and a separate clean pair for AC10. Store the idempotency key as a fixed variable when replaying; generating a new GUID on every send tests duplicate handling instead. The authoritative reset and concurrency automation is in the isolated integration suite; no reset/fault-injection endpoint is exposed by the application.

AC13 is verified on the UI; inspect request headers to ensure retry keeps X-Idempotency-Key. AC12 uses injected backend save failures and database assertions.

Run the focused suite:

```powershell
Set-Location "D:\SE172316\Semeter 6\HCM26_CPL_JAVA_10\backend"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
& "C:\Program Files\apache-maven-3.9.16\bin\mvn.cmd" "-Dtest=WorkspaceAcceptanceIntegrationTest,WorkspaceDemoIntegrationTest,ProjectHubIntegrationTest,WorkspacePersistenceIntegrationTest" test
```

Use Maven clean when removing old compiled feature classes. The default application database is jdbc:h2:file:./data/fams_lms; tests use isolated in-memory/file databases with the test profile.

From frontend, run npm.cmd run build. Browser checks use isolated contexts to verify dropdowns, no-members guards, cancellation, pending locks, retry keys and removal of the retired menu/route.

