# Class Setup: implementation and usage

Date: 09/11/2026 (Asia/Saigon). This document describes the implemented source, not an instruction to change existing class records automatically. See [the routing report](FRONTEND_ROUTING_404_FIX_REPORT.md) for live backend/version evidence and navigation checks.

## Reused model and APIs

No new persistence entity or Trainer entity was created. Class identity comes from `TrainingClassRepository`; program data uses `TrainingProgram`, `ClassTrainingProgram`, `ProgramSubject` and their existing repositories. Assignments use `TeachingAssignment`, `TeachingAssignmentRepository`, `TeachingAssignmentRequest` and `TeachingAssignmentResponse`. Trainer identities remain external, using `ExternalTrainerDTO`/`ExternalApiService`.

The survey found repositories/DTOs but no existing controller/service for writing program links or teaching assignments. Existing program/subject services retain their catalog CRUD and version logic.

Reused endpoints:

- `GET /api/classes` and `GET /api/classes/{id}`: internal class picker/profile.
- `GET /api/programs?status=ACTIVE&page=...&size=1000`: paginated ACTIVE program catalog. Existing aliases under `/api/training-programs` remain unchanged.
- Existing `GET /api/programs/{id}/subjects` remains available; Setup returns an eligibility projection of those same persisted Program Subjects for the linked program. No second subject-management endpoint was added.
- `GET /api/external/trainers?status=active` and `GET /api/external/data-source`: existing trainer catalog and provenance. The frontend reads provenance after fetching trainers, because response metadata can identify sample data.
- `GET /api/classes/{id}/readiness`: the authoritative saved-data readiness result. No optimistic READY result is generated.

## Added minimal APIs

All paths use **internal** Class ID, never Shared Class ID. All existing unrelated APIs are unchanged.

1. `GET /api/classes/{classId}/setup` — returns internal class identity/dates, saved Program/Master Trainer, optional persisted program link, linked subjects with eligibility, and active saved assignments. Requires `CLASS_READ`, `PROGRAM_READ`, `ASSIGNMENT_READ`.
2. `PUT /api/classes/{classId}/program-link` — accepts positive `programId`; returns the saved link. Requires `CLASS_READ`, `CLASS_UPDATE`, `PROGRAM_READ`. It does not expose the assignment list to callers without assignment-read permission.
3. `POST /api/classes/{classId}/teaching-assignments` — creates MAIN using the existing request DTO; returns 201. Requires `CLASS_READ`, `PROGRAM_READ`, `ASSIGNMENT_CREATE`.
4. `PUT /api/classes/{classId}/teaching-assignments/{assignmentId}` — updates the owned active assignment. Requires `CLASS_READ`, `PROGRAM_READ`, `ASSIGNMENT_UPDATE`.

The assignment body uses `classId`, `programSubjectId`, `trainerId`, `role=MAIN`, `effectiveFrom`, and optional `effectiveTo`. Body Class ID must equal the URL Class ID. IDs must be positive and dates use `YYYY-MM-DD`. Unknown classes and assignment IDs owned by another class return 404. Invalid inputs return 400; incompatible links/duplicates return 409; unavailable/unverified trainer directories return 503 with a BLOCKED explanation.

## Business validation and isolation

- Setup checks an active internal class before any write. There is no fallback to a shared class with the same numeric ID.
- The selected program must be ACTIVE, non-deleted, and have an eligible active subject. Its code/name must match saved Class Info Program, ignoring case and outer whitespace. A mismatch is reported, not corrected automatically.
- Program-link PUT reuses the single existing link row, so retrying it does not create a duplicate. Switching programs is rejected while active assignments exist; assignments are never silently deleted or reparented.
- Program Subjects must belong to the linked program and reference active subjects. Inactive subjects are shown as unavailable and cannot be assigned.
- MAIN dates must cover the full class date range: Effective From <= class Start Date; Effective To >= class End Date or blank/open-ended.
- Writes take the existing pessimistic class-row lock. Program validation also locks the program while the transaction is active. Duplicate trainers/overlapping MAIN assignments for the same class and Program Subject are rejected; updates exclude their own assignment ID from duplicate checks.
- The server re-fetches the real active trainer directory at save time, requires a unique eligible trainer ID and a name/email matching saved Master Trainer. Selecting a trainer never changes Master Trainer automatically.
- No Class Info, enrollment, calendar or other class records are written by Setup. Tests verify that other classes remain unchanged.

## Using the interface

Open **Class Details → Class Info → Class Readiness → Open Class Setup**, or use the **Class Setup** button in that panel. It opens a dialog and leaves all five FAMS tabs intact. The existing sidebar entry **Training Management → Kế hoạch môn học lớp** opens `/class-setup`; select an internal class there. `/class-setup?classId=6` selects internal class 6 directly.

1. Review the class code, internal ID, dates, saved Program and Master Trainer shown at the top. Use **Review Class Info** if an explicit profile correction is needed. The agent has not made that correction for classes 4 or 6.
2. Choose the actual ACTIVE curriculum from the catalog. If it does not match saved Program, Save Program Link stays disabled and explains the mismatch. Correct the profile only after confirming the intended curriculum, then save the link.
3. The linked program's subjects load from persisted records. Choose an eligible subject.
4. Choose a verified active trainer. If the Master API is sample/unreachable/unverified, the form displays BLOCKED and disables assignment saving; it never inserts a sample trainer. A trainer-name mismatch directs the user to review Class Info explicitly.
5. Enter dates covering the displayed class interval. For class 6's currently saved dates, that means From <= `2026-12-09`, To >= `2027-03-09` or open-ended, provided those class dates are correct.
6. Click **Create MAIN Assignment**. To update one, use **Edit assignment {id}**, then **Update MAIN Assignment**. Successful writes invalidate Setup, class profile/calendar consumers and Readiness queries; the dialog displays a newly fetched readiness result.

This only supplies Basic Information and Trainer Assignment evidence. ACTIVE enrollments, actual valid sessions, and legitimate operational/room data are still required for the other readiness checks. Readiness never changes the class lifecycle status automatically.

## Class 6 Program inconsistency

The first verified profile/SELECT snapshot had `FR_NFP_DOTNET` while its code/Skills indicated Java. There is no rule deriving Program from the class code: the form submits Program text and `TrainingClassService` persists it. Available evidence does not establish who selected that value; no author attribution is made.

A later live read during this work returned `[FSA.HCM] FR_NFP_JAVA_KS`, with `traineeType=Campus` and null delivery/format/skills/location fields. These changes were observed, not written by the agent. Neither the earlier DOTNET text nor this later Java label matches the available ACTIVE local program codes `FR_NFP_JAVA_2`, `FULLSTACK_JAVA`, `BACKEND_JAVA` exactly. The application reports the discrepancy and requires explicit curriculum review. It does not pick the nearest program or force a match.

## Remaining blockers and deployment safety

The current Master API at port 9090 is `mock-server.js`. Its data is not real trainer/room evidence. The default `EXTERNAL_API_SAMPLE_DATA` is now true for the supplied sample configuration, so even an older mock process without provenance headers is rejected. For an actual authoritative directory, configure `EXTERNAL_API_BASE_URL`/credentials and explicitly set `EXTERNAL_API_SAMPLE_DATA=false` only after verifying that source. This does not turn a mock into a real directory.

The backend uses H2 memory with `ddl-auto=create-drop`. No restart/stop/start command, database reset, class-data write or Git write was issued by the agent. Nevertheless, the existing DevTools log records background reloads around 14:06; later live GETs and OpenAPI already expose these Setup APIs. Current process identity is the nested `training-management/backend` application. Do not restart it casually or restore an earlier snapshot over subsequent user edits. Read snapshots are available under workspace `.run/class-setup-live-evidence.json` and the earlier `.run/class-6-api-evidence.json`.

Validation runs under `.run/class-setup-validation/backend`, outside the live watched target directory. Backend results: **209 tests passed**, including 17 Setup integration tests. Frontend results: **233 tests across 19 files passed**, plus TypeScript and production build. Routing details are recorded in the routing report. A concurrently changed `RefreshTokenServiceImpl.java` was not edited by this work; its current contents were copied into the isolated validation source before the final full backend run.

## Changed source files

- Backend: `system/training/ClassSetupController.java` (new), `ClassSetupService.java` (new), `ClassReadinessService.java`.
- Existing model/repositories: `system/trainingprogram/TrainingProgramRepository.java`, `TeachingAssignmentRequest.java`, and identity comments in `ClassTrainingProgram.java`/`TeachingAssignment.java`. No schema/entity duplication.
- Configuration: `backend/src/main/resources/application.properties` (sample-directory default).
- Backend regression tests: `system/training/ClassSetupIntegrationTest.java` (new).
- Frontend: `api/features/class-setup.api.ts` (new), `pages/management/training/class/ClassSetupPage.tsx` (new), `components/ClassSetupForm.tsx` (new), `ClassReadinessPanel.tsx`, and the route registry. Associated setup/readiness/navigation tests were added/updated.
- Routing/session identity changes and their file list are documented separately in the routing report.
