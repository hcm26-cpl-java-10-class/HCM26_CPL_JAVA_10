# Session Import: source-data and validation audit

Checked on 2026-10-28 (Asia/Ho_Chi_Minh). Scope: the active root backend/frontend in
D:/OJT/modulesubject_dev and the /sessions screen, whose entity is system.demo.session.Session.
The separate /api/study-sessions module uses Subject/ProgramSubject and a different file contract.
Its IDs and template must not be substituted for Session's Topic ID template.

## Runtime evidence

- The running backend is PID 14384, HTTP 8080; startup log reports local,schedule-demo.
  Last observed Tomcat startup is 13:23:03.852. No restart was performed in this audit.
- backend/src/main/resources/application.properties:3 defines server.port=8080.
  Line 65 defines external.api.base-url with default http://localhost:9090.
  These settings have different purposes. No service was listening on 9090 during the audit.
  StarterProject202603/backend also defaults to 8080, but it is not the running project root.
- application-local.properties points at jdbc:h2:mem:base_crud_local, with create-drop.
  Excel is the import input. Existing JPA repositories store accepted domain records in H2;
  the Excel workbook itself is not the assignment repository. No schema/database was added.
- Authenticated GET /api/external/data-source returns {sampleData:true}.
  Active classes/trainers return two items each (IDs 1,2), and rooms return two items (IDs 1,2).
  Source code identifies these as local sample references, not verified Excel imports.
- GET /api/teaching-assignments?size=100 returns totalElements=0.
  GET /api/classes/1/teaching-assignments/available?date=2026-10-28 and the class 2 equivalent
  both return HTTP 200 with []. Class/program-subject links do not create teaching assignments.
- There are seven subjects, but presence alone does not establish Excel provenance.
  SubjectDataInitializer and LocalClassSetupDataInitializer seed subjects/local curriculum.
- No Topic catalogue endpoint/entity or authoritative Topic-to-assignment mapping was found
  in the supplied root backend, StarterProject202603 backend, or runtime OpenAPI document.
  The topic-marks endpoints are grade endpoints, not a Topic catalogue.
- API snapshots are saved privately under .runtime/session-import-audit/runtime-before.json
  and runtime-after.json. Both show zero assignments and sampleData=true. Sessions number 12
  in both, but IDs/dates changed between the snapshots (1..12 to 13..24), and subject responses
  also changed. Therefore this audit does not claim the live domain dataset was byte-identical.
  The audit issued GET requests and login only; no domain write was issued against the live app.

## Exact failure and the two assignment sources

TeachingAssignmentSessionGuard.java:40 calls TeachingAssignmentRepository.findById with
candidate.teachingAssignmentId and throws BusinessValidationException with
"The teaching assignment no longer exists." if no row exists. TeachingAssignmentRepository
reads the existing teaching_assignments JPA table, not the Excel file or demo reference list.
With an empty repository, any explicit positive Teaching Assignment ID fails this check.
The actual Session_Import_Theo_Template.xlsx workbook was not attached/found in the inspected
locations, so the exact cell values of that file have not been independently certified.

DemoScheduleReferenceProvider (schedule-demo) supplies literal reference assignments 1/2/3.
Those objects are not inserted into TeachingAssignmentRepository. Consequently a number can
pass the demo schedule reference lookup and still fail the local assignment repository check.

The previous transaction rollback-only error had a separate cause: preview caught a business
exception after the participating guard transaction had marked the enclosing transaction for
rollback. The existing preview guard now declares noRollbackFor=BusinessValidationException;
regression tests exercise this with real Spring transactions. It still rejects invalid assignments.
The new import directory lookup also isolates a failed lookup transaction, so a per-row
not-found error does not poison the containing preview/save transaction.

## Is Teaching Assignment ID required?

Session.java:56 has @ImportField(name="Teaching Assignment ID") without required=true,
and teaching_assignment_id is nullable. In the legacy path, a blank skips the explicit repository
lookup in TeachingAssignmentSessionGuard. The schedule engine still requires an active reference
matching classId, topicId, trainerId and the full date interval. Blank was not proof that a real
stored assignment existed; demo references could make such an import look valid.

The corrected Import-only path keeps the nullable file column but requires an actual eligible
assignment to be identified. An explicit ID must exist. A blank is resolved only if the official
available service yields exactly one eligible stored assignment for the class/trainer/full interval.
Zero matches and multiple matches are row errors requiring real assignment data or explicit selection.
No assignment is created by this resolution. No topicId is derived from Subject or ProgramSubject.
Legacy CRUD and the other owners' endpoint contracts are unchanged.

## Thang's available API

ClassSetupController.java:62 exposes:
GET /api/classes/{classId}/teaching-assignments/available?date=YYYY-MM-DD
with ASSIGNMENT_READ permission. It also accepts from/to (LocalDateTime) for a complete interval,
and optional programSubjectId. Do not combine date with from/to.

ClassSetupServiceImpl.getAvailableClassAssignments calls getSchedulingDirectory, which checks
class existence/status/dates, the class's assigned training program, ACTIVE program, active local
assignments belonging to that program, ACTIVE subjects and active trainers. Date filtering covers
both endpoints of the session against class/assignment validity. Returned fields include actual
assignment id, classId, trainerId, programSubjectId and subjectId. It does not supply topicId.
The Import policy also checks the stored program/subject active flags and assignment identity.

The legacy ExternalScheduleReferenceProvider.load has a DIFFERENT contract: it reads an external
list of ScheduleReferences.Assignment with topicId and status, by default from external base 9090.
The local /api/teaching-assignments search response is paginated and has Subject/ProgramSubject
fields. Pointing the external base at localhost:8080 does not repair this contract and may route
resource proxy calls back to themselves. No URL/profile/configuration was changed in this audit.
An authoritative Topic/reference source is still needed to complete real Session scheduling.

## Data to obtain before building a real Excel file

1. Obtain verified real Class/Trainer/Room resources from the team's existing source. Current
   application proxy routes are GET /api/external/classes, /classes/{id}, /trainers and /rooms.
   The non-local ExternalApiServiceImpl reads the external /api/classes, /api/classes/{id},
   /api/trainers and /api/rooms endpoints. sampleData=true is not proof of real Excel provenance.
2. Obtain real Subject and TrainingProgram curriculum data and the class/program association:
   GET /api/subjects, GET /api/programs, GET /api/programs/{id}/subjects,
   GET /api/classes/{classId}/program-subjects. Do not assume seeded curriculum is real input.
3. Import genuine teaching assignments with the EXISTING feature:
   GET /api/teaching-assignments/import-template and POST /api/teaching-assignments/import.
   That template uses Class ID, Program Subject ID, Trainer ID, Role, Effective From, Effective To.
   TeachingAssignmentFileService calls ClassSetupService.createAssignment per row and stores
   records in the existing assignment repository. It does not consume Topic ID.
4. Read actual eligible IDs from the available API for each proposed session's date/full interval.
   Use only a result whose class/trainer and curriculum relationship match the actual session.
5. Obtain the authoritative Topic ID and its relationship to these assignments from the Topic/
   scheduling owner or existing shared reference service. Topic != Subject != ProgramSubject.
   No such mapping will be guessed, added to schema or replaced with equal numeric IDs.

Until those inputs are available, no filled workbook is certified as a real valid import.
The previously generated Session_Import_Dung_Dinh_Dang.xlsx is a demo/format example only;
its earlier 12/12 validation against schedule-demo is not validation against real data.
It was preserved, not overwritten or reused as a real-data deliverable.

## Session workbook contract

Use the first worksheet; row 1 is the header, data begins at Excel row 2. Exact template order:
Class ID; Topic ID; Trainer ID; Teaching Assignment ID; Room ID; Meeting URL;
Session Title; Start Time; End Time; Location / Room.

- Required: Class ID, Topic ID, Trainer ID, Session Title, Start Time, End Time.
- IDs: positive exact Long values. Numeric 1.0 is syntactically an integer, not evidence that ID 1
  exists. Fractional/zero/negative/overflow IDs are rejected. Keep IDs as Excel text where needed
  to avoid Excel's numeric precision limit.
- Start/End: Excel date/time cells, or yyyy-MM-ddTHH:mm / yyyy-MM-dd HH:mm (seconds accepted).
  No timezone suffix; scheduling timezone defaults to Asia/Ho_Chi_Minh. End must be after Start.
- Existing scheduling rules require the same working day within configured opening/closing hours,
  class/assignment date bounds, allowed weekdays and non-holiday dates. Defaults are 07:00-22:00,
  all seven days, maximum 200 rows; runtime rules are returned in Preview.
- Venue: valid Room ID, recognized Location / Room, or valid http(s) Meeting URL. An explicit room
  ID must exist; when both ID and room name are provided they must agree.
- Title/location maximum 150 characters; meeting URL maximum 1000. Class/trainer/room bookings
  must not overlap existing bookings or peer rows. Adjacent intervals are allowed.

## Changes and verification

ImportPreviewDialog keeps cell editing and Recheck; help now explains real assignment selection.
SessionImportService routes file Preview, edited-row Recheck, file Import and edited-row Import
through one coordinator. The policy returns original-row/column D messages, rejects sample sources,
checks local assignment identity/status/dates/curriculum and calls the official available service.
Resolved IDs are returned in preview values so the edited JSON confirms the same selection.

Confirmation acquires the existing shared write lock, repeats current assignment eligibility,
and calls the existing atomic SessionService writer. The existing Topic/reference/resource/time/
conflict validations remain in that writer. Preview does not write sessions or mark everUsed.
No success is reported merely because syntax is valid or the client previously showed green rows.

Verification in an isolated copy under .runtime/session-import-audit/build/backend (live backend
classes were NOT rebuilt): 136 backend tests in 11 suites, 0 failures, 0 errors, 0 skipped.
This includes 18 new assignment-integration cases, 34 import parsing/edited-row cases, transaction
rollback regressions, the real available API controller/service integration tests, assignment Excel
I/O, schedule persistence/engine checks, and StudySession CRUD/lifecycle/statistics/I/O regressions.
Fixture records and mocked external boundaries exist only in test contexts, never in the live DB.
Preview -> edit -> Recheck -> Import passes against persisted isolated fixtures; nonexistent/blank
without match/inactive/wrong class/wrong trainer/outside validity/ambiguous assignments fail.
Changing an assignment after a valid Preview is rejected on Save, with no session inserted.

Frontend: 16 tests pass; TypeScript + Vite production build passes (existing large-chunk warning);
ESLint passes for ImportPreviewDialog. Reports: .runtime/session-import-audit/test-results.json,
test-regression.log, test-assignment-final.log, frontend-tests.log, frontend-build.log, frontend-lint.log.
The first broad run exposed a test stubbing error; it was fixed and the affected import/transaction suites rerun
successfully. test-results.json aggregates the final report for each suite.

The running backend was not restarted/reconfigured and still executes its previously loaded code.
This source patch is verified but not deployed there. The live real-data end-to-end import is NOT
certified: assignment store is empty, references are sample, and Topic linkage source is missing.
Configuration files, schema, migrations and other owners' APIs were not changed. No commit/push/
pull/merge was performed. Existing uncommitted work was backed up before edits under
.runtime/session-import-audit/baseline (manifest and exact file copies).
