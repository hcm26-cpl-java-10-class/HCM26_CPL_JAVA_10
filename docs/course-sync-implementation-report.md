# Course and Enrollment backend synchronization report

Date: 2026-11-04, Asia/Saigon. Branch: `feature/user-profile-update`.

The approved frontend integration is implemented. Course Management and Enrollment Catalog now read the existing backend Course API through one shared adapter. No backend source, Course contract, schema, datasource configuration, or existing database was changed in this phase. Browser download delivery remains unverified, as explained below.

## Exact implementation files

The following existing files were updated relative to the start of this phase (some were already untracked):

1. `frontend/src/pages/management/demo/course/index.tsx`
2. `frontend/src/pages/management/demo/course/components/CourseModal.tsx`
3. `frontend/src/pages/management/demo/course/components/CourseTable.tsx`
4. `frontend/src/pages/management/demo/course/components/CourseDetailModal.tsx`
5. `frontend/src/pages/management/demo/course/components/DeleteConfirmDialog.tsx`
6. `frontend/src/pages/management/demo/course/components/ImportExportModal.tsx`
7. `frontend/src/pages/management/demo/course/types.ts`
8. `frontend/src/pages/management/demo/enrollment/CourseEnrollmentsPage.tsx`
9. `frontend/src/pages/management/learning/learning-catalog.api.ts`
10. `frontend/tests/course-import-sync.test.mjs`
11. `frontend/tests/learning-enrollment.test.mjs`

New implementation and verification files:

12. `frontend/src/integrations/courses/course-data.ts`
13. `frontend/src/integrations/courses/course-queries.ts`
14. `frontend/src/integrations/courses/course-workbook.ts`
15. `frontend/tests/course-data.test.mjs`
16. `frontend/scripts/verify-course-backend-sync.mjs`

This report and `docs/course-sync-verification/` contain generated evidence: `after-create.json`, `after-import.json`, `real-api-results.json`, `import-15-courses.xlsx`, `verified-backend-export.xlsx`, `real-enrollment.jpg`, `my-learning-after-account-switch.jpg`, `frontend-tests.log`, `frontend-build.log`, `metadata-tests.log`, `backend-tests.log`, and `final-git-status.txt`.

## Data flow and legacy browser records

Previously Course Management used CourseContext/localStorage as its Course store while the Learning Catalog read the backend. Browser-only imports could therefore appear persisted in Management without existing in Catalog or supporting real enrollment.

Both views now use `courseData.page` and account-scoped query keys. Create, edit, delete, active-state changes and imports call existing Course APIs. Only backend-confirmed results count as saved. Successful mutations refresh Course, detail, enrollment and Learning queries. Errors preserve records and appear in the existing dialogs. The table/grid, toolbar, form and import/export interaction structure are retained; unsupported metadata controls are disabled with an explanation.

CourseContext and its existing stored records remain intact, but neither active view consumes it as an authoritative Course store. The shared adapter only reads legacy Course storage counts for a preservation notice; it never deletes, migrates or writes those records. No localStorage clearing was performed. A test verifies that 15 legacy records and unrelated preferences remain unchanged. The user's existing browser profile data was not copied into the isolated test origin or migrated. The provider remains mounted for compatibility; no production `useCourse` consumers remain outside its definition.

## Real isolated verification

The real application ran against `jdbc:h2:mem:course_sync_20261104` on backend port 8093 and frontend port 5189. The actual JDBC target was checked before testing. Existing seeded admin, student and teacher accounts authenticated through the normal backend. No API mocking was used for the following browser and HTTP checks. Both temporary servers were stopped afterward; the in-memory fixtures are disposable and do not populate the user's existing database.

| Action | Backend Course total | Management | Active Catalog |
| --- | ---: | ---: | ---: |
| Fresh isolated startup | 4 | 4 | 4 |
| UI XLSX import of 15 distinct valid courses | 19 | 19 | 19 |
| UI create of one temporary course | 20 | 20 | 20 |
| Successful UI deletion of that course | 19 | 19 | 19 |
| Edit imported course, retaining its backend ID | 19 | 19 | 19 |

Counts were read from backend page responses and verified in both visible views. The edit changed name, description, instructor and thumbnail in both views; the real API check confirmed the original backend ID was retained. A separate active-state check produced 19 Management / 18 Catalog records while one Course was inactive, then restored 19 / 19. Active is not presented as publication status.

## Persisted fields and XLSX limits

| Field | Behavior |
| --- | --- |
| Name | Persisted through existing API, required, maximum 150 characters |
| Instructor | Persisted as the backend's text field, maximum 100 characters; no instructor-account link is inferred |
| Description | Persisted, maximum 500 characters |
| Thumbnail URL | Persisted, maximum 255 characters |
| Active | Persisted boolean; missing workbook values explicitly default to true with a warning |
| ID and audit timestamps | Backend-generated; exported as read-only values, never imported as identity or dates |
| Category, Level, Publication Status, Instructor Email | Unsupported by Course contract; warned during preview, unavailable in UI, blank in XLSX with Readme explanation |
| Sections and Lessons sheets | Explicitly reported as not imported; not exported by this Course operation |
| Lesson Count and Duration | Not Course write fields; Learning uses actual lesson API data when authorized, otherwise unavailable |

Original demo descriptions and thumbnail URLs remain persisted by the existing Learning initializer. No fake category, level, publication, instructor-account, lesson-count, duration or progress values were added.

The import reads the Courses sheet, previews unsupported columns/sheets, then asks the user to explicitly import supported fields. It uses normal existing Course create calls rather than the backend generic workbook import route. Normalized names are only conservative duplicate-detection keys: one identical metadata match is skipped, conflicting or ambiguous matches fail, and no record is overwritten. Invalid rows are reported with their Excel row number. A request failure stops further writes and reports unattempted rows; this multi-request import is not transactional. An uncertain network failure is not automatically retried.

Results:

- Real UI XLSX import: imported 15, skipped 0, failed 0, unattempted 0. Unsupported metadata and the Sections sheet were disclosed before persistence.
- Real backend duplicate import: imported 0, skipped 1, failed 0; existing record unchanged.
- Real backend invalid/conflicting import: imported 0, failed 4; backend total remained 19.
- Real backend export: shared export code fetched all pages and produced `verified-backend-export.xlsx` with 19 authoritative rows. Parsing the actual XLSX confirmed 19 rows and the limitations Readme. Export includes all backend records even when Management search is filtered.
- Browser XLSX download: the export control was exercised without a visible application error, but the automation download event timed out and no downloaded artifact was confirmed. The separate browser downloads page was blocked by browser policy and was not bypassed. Therefore browser file delivery is **unverified**, not reported as an end-to-end pass. CSV/JSON browser downloads were not independently verified.

The existing backend generic Course import/export implementation does not expose the annotations required by its workbook machinery. That backend limitation remains unchanged. The new frontend adapter supports the fields above through existing CRUD; it does not claim full compatibility with the original multi-sheet workbook.

## Enrollment and My Learning

The earlier Learning implementation is preserved: direct Enroll calls `POST /api/enrollments` without a confirmation popup. The exact success toast is `You are enrolled in this course.` The Enrolled badge and Continue learning button appear only after backend confirmation. Pending requests and confirmed enrollments prevent duplicates; backend duplicate enforcement remains in place.

An imported Course was enrolled through the real browser. Continue learning opened My Learning with the actual enrolled Course. Refresh retained the record. Logging out and signing in as the student showed zero enrollments; signing back in as the administrator restored the one enrollment. A duplicate API enrollment was rejected and still left exactly one record.

Deletion of the enrolled imported Course was rejected by the existing backend foreign key. The UI kept the dialog/error and Course record, and the real API check confirmed both Course and enrollment were retained. Student Course create/delete calls were denied; another user's Learning endpoint was denied; teacher personal Learning/enrollment calls were denied. Existing RBAC was not changed.

Administrative Learning Progress continues to use existing Learning Overview and actual enrollment data. Completion, progress percentages, activity statistics and certificates remain unavailable where the backend has no supported records or fields; no invented progress statistics were introduced.

## Demo initialization and ownership

The existing Learning-owned `LearningDemoCourseInitializer.java` was not changed in this phase. It requires the explicit `local-demo` profile and enable flag, requires that profile to be the only active profile, and checks the actual connection is a named in-memory H2 database. It rejects file H2, MySQL, production/unknown targets and combined profiles. It uses CourseService, creates only missing normalized demo names, preserves existing records and uses generated IDs/timestamps. Repeated initialization and target guards passed regression tests. Initial isolated startup created exactly the four original demo courses.

Only the seven approved Course frontend files changed. Course backend entities, controllers, services, repositories, contracts and configuration remain unchanged. The existing CourseContext, CourseDetailPage and mockData files are byte-for-byte unchanged. Comparing 48 baseline file hashes found exactly the 11 intended existing-file changes listed above; the remaining 37 files, including prior backend work and `data/base_crud.mv.db`, were unchanged. The existing database SHA-256 remained `55879f322e12203118fed29099ac28a1784c4d4312c9047e6f14c8501205a55b`.

No commit, push, merge, branch switch, database reset or shared-database mutation was performed. Pre-existing changes remain in the working tree. `docs/SRS_FAMS_LMS.md` and `docs/images/` appeared from outside this implementation and were left untouched.

## Regression results and practical limits

- `npm test`: 58 passed, 0 failed, 0 skipped.
- `node --test scripts/test-course-metadata.mjs`: 5 passed, 0 failed.
- `npm run build`: TypeScript and Vite passed; existing bundle-size warning remains.
- Backend selected regression suite: 52 passed, 0 failed/errors/skipped. Tests: LearningDemoCourseInitializerTest, LearningDemoIntegrationTest, LearningRecordsServiceTest, LearningAccessTest, CourseEnrollmentControllerTest, ProfileControllerTest, ProfileServiceTest and JwtAuthorityRefreshTest. Maven ran with `-DforkCount=0` outside the sandbox for Windows Mockito attachment; integration data used isolated memory H2.
- `git diff --check`: passed; Git emitted existing LF/CRLF notices.

Frontend unit/render tests use controlled fixtures and are reported separately from the authenticated real browser/HTTP checks. Simulated API/network failures and session-change import cancellation passed unit tests. The real backend verified rejected deletion, duplicate enrollment/import, invalid rows and permission failures. A real network outage was not induced. No mocked browser test is presented as real end-to-end evidence.

Remaining limits are unsupported Course metadata/multi-sheet persistence, non-transactional sequential imports, backend-provided deletion error wording, and unverified browser download delivery. No backend changes were made to work around those limits.

Final Git status is captured verbatim in `course-sync-verification/final-git-status.txt`: 22 modified tracked files and 25 untracked status entries, including the preserved pre-existing work and external documentation additions. The branch remains `feature/user-profile-update`; the working tree remains intentionally uncommitted.
