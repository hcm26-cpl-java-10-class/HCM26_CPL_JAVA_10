# Learning integration implementation report

Date: 2026-11-04 (Asia/Saigon). Branch: `feature/user-profile-update`.

## 1. Scope and ownership

Implemented the approved Learning-only scope. No Course entity, controller, service,
repository, API contract, schema, Course Management UI, or existing database
configuration was edited. No commit, push, merge, branch switch, database reset,
or operation against a shared database was performed.

SHA-256 comparison against the starting working tree confirmed all 27 protected
files unchanged: the inspected Course backend/UI files, main resource files, and
existing `data/base_crud.mv.db`. Of 51 snapshotted existing files, 43 are byte-for-byte
unchanged. The other eight are the Learning integration files intentionally updated
below. No pre-existing file was deleted. Existing unrelated uncommitted changes and
untracked artifacts were retained.

Admin View still renders the Course group's existing Course Management component.
Learner View at `/courses` renders the API-backed Learning Catalog through a small
Learning-owned route adapter. The Course group's browser-local management/import
state is deliberately not rewritten or synchronized by this task. Consequently,
seeding the backend does not populate that unchanged management table's local store.

## 2. Architecture and original causes

The current repository uses file-based H2 (`jdbc:h2:file:./data/base_crud`) with
`ddl-auto=update`; the task's assumed in-memory/create-drop configuration was stale.
There was no Course startup initializer. The active Catalog read `CourseContext`
browser storage, so it remained empty until browser-side import even if Course
records existed in the backend.

The Enroll handler opened `EnrollConfirmationModal` and called a local context
toggle. It never called the enrollment API, and fabricated an initial 15% progress
record. Personal Learning merged those unscoped local records over backend results.
Those Learning dependencies and local progress/completion actions were removed.
The unused original modal file remains intact to preserve the existing untracked
artifact; the active Catalog neither imports nor renders it.

## 3. Demo initializer

`LearningDemoCourseInitializer` is registered only when both are explicitly enabled:

- Spring profile: `local-demo`.
- Property: `learning.demo.courses.enabled=true`.

Before any Course service call, the runner also requires that `local-demo` be the
only active profile and verifies the actual JDBC connection's product is `H2` and
its URL identifies a named `jdbc:h2:mem:` database. File H2, TCP H2, MySQL, unnamed
memory targets, unknown products, and combined/unknown profiles are rejected.
The existing default datasource and DDL settings remain unchanged.

The runner pages through the existing `CourseService.getAll` contract and creates
only missing records through `CourseService.create`. The demo skip key normalizes
names with Unicode NFKC, whitespace collapsing, and locale-independent case folding.
Any normalized match is conservatively skipped, including multiple matching rows;
the name is not treated as a globally unique ID or used to select/update a record.
Existing metadata, IDs, timestamps, and enrollments are never overwritten. Repeated
initialization and a normalized-name collision were tested. Concurrent exact-name
creation is reconciled only after a service read confirms a matching record exists.

The temporary startup security context has only `COURSE_READ` and `COURSE_CREATE`
and is always restored. No account or role is modified to grant access.

An empty isolated database produced exactly four records:

| Name | Description | Thumbnail video ID |
| --- | --- | --- |
| Java Fundamentals | Introduction to Java, OOP, and basic programming concepts. | iCYoaTvE9vo |
| Spring Boot for Beginners | Learn backend APIs, Spring Boot architecture, and database integration. | efCONw5rdA4 |
| Java Spring Boot | Khóa học Java và phát triển backend với Spring Boot | RksqUNilQwc |
| Database Design | ER diagrams, SQL, and relational design fundamentals. | LuVEozf3wnU |

All use the supplied `https://img.youtube.com/vi/<video ID>/hqdefault.jpg` URL,
`instructor="Teacher User"`, and supported `isActive=true`. IDs and timestamps are
generated normally. The source is the user's supplied original four-course metadata,
not the old 15-course JSON. That legacy manual loader/dataset was left unchanged and
is not called by this initializer.

### Optional isolated local launch

With the project's usual required application environment already configured, launch
a separate disposable demo process with explicit arguments. This is an example,
not an operation performed against the existing application:

```powershell
Set-Location 'D:\FPT_OJT\HCM26_CPL_JAVA_10_user-profile-feature\backend'
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.arguments=--spring.profiles.active=local-demo --learning.demo.courses.enabled=true --spring.datasource.url=jdbc:h2:mem:learning_demo --server.port=8081'
```

No configuration file or DDL setting needs to be edited. Configure a separate
frontend process to use that demo API if inspecting it interactively. In-memory H2
is disposable: a new backend process creates a new database and seeds the four
courses again. Enrollments survive page refresh/login/view changes while that
database exists; they do not survive disposal of the in-memory database. The
existing retained database was neither started nor reset by these checks.

## 4. Persisted fields and limitations

Persisted and verified through the real service/controller mapping: course name,
original description (including Vietnamese), original thumbnail URL, instructor
text, active flag, generated ID, and generated audit timestamps.

Unsupported by the current Course contract: category relationships, course level,
publication status, and instructor-account assignment. No Category/Level values
are inferred from names. No record is labeled Published. The Catalog explicitly
lists active courses using the existing `isActive` filter and states that
publication metadata is unavailable; it cannot enforce a publication workflow that
the current backend does not model. Category/Level filters are disabled and labeled
unavailable rather than implemented with invented frontend metadata.

The existing Lesson API supplies course-filtered lessons and `durationMinutes`.
The Catalog counts actual active lesson records and sums their minutes, including
all response pages. A missing duration or denied/failed lesson read is unavailable.
No lessons were seeded. A fresh demo therefore shows zero lessons/zero minutes,
not the screenshots' approximately ten lessons/57–58 minutes. The supplied thumbnail
URLs are preserved; external YouTube availability determines the returned imagery.

## 5. Enrollment and personal Learning

| Before | After |
| --- | --- |
| Confirmation modal and local toggle | Direct existing `enrollmentApi.enroll(courseId)` → `POST /api/enrollments` |
| Locally fabricated success/progress | State changes only after a valid backend response or confirmed personal enrollment read |
| Shared browser enrollment storage | Authenticated `/api/enrollments/my-courses` and `/api/learning/me`, with account-scoped query keys |
| Local progress advancement/completion | No invented progress actions or achievements |

While pending, enrollment buttons are disabled and the selected button displays
`Enrolling...`. Requests for the same course/account/query session share a promise,
including rapid clicks. The existing backend duplicate check and unique
user/course constraint were not changed.

Success uses the existing Sonner notification system, green styling/icon, and exact
text `You are enrolled in this course.` The card then shows a green Enrolled badge
and a `Continue learning` link to existing `/my-learning`. If a conflicting request
is confirmed already enrolled through the backend, the UI shows an informational
existing-enrollment message instead. Failures retain the previous card state and
show an error toast. No browser alert, confirmation popup, or success dialog is used.

Personal enrollment, Learning Overview, and authorized target-user Learning queries
are refreshed after confirmation. Late responses cannot repopulate a cache cleared
by logout/account changes, including a later login with the same email. View changes
retain the authenticated user's records. Profile and header Learning links use the
existing Learning permission checks; local enrollment storage cannot grant access.

My Learning preserves actual description, instructor, thumbnail, enrollment date,
and separate enrollment/Course IDs. The Learning backend mapping now includes the
already-supported Course description field. Personal and administrative target-user
queries remain separate, and the target-user endpoint retains its existing scope.

## 6. Administrative Learning Progress

The report lists actual Courses through the unchanged Course API, with server-side
search and pagination. There is no course-wide enrollment/progress reporting API in
this repository. Learner counts, completed learner counts, average progress,
completion rate, and certificates are shown as unavailable. Personal enrollment
counts are labeled `My enrollments` and never substituted for administrative learner
counts. Backend progress/completion/activity/certificate nulls stay unavailable in
My Learning and Overview. No new reporting API, schema, or fictional statistics
were introduced.

## 7. Verification results

| Command/check | Actual result |
| --- | --- |
| `npm.cmd test` in frontend | 48 passed; 0 failed; 0 skipped |
| `node --test scripts/test-course-metadata.mjs` in frontend | 5 passed; 0 failed |
| `npm.cmd run build` in frontend | TypeScript and Vite production build passed; existing large-bundle warning remains |
| `.\mvnw.cmd '-DforkCount=0' '-Dtest=LearningDemoCourseInitializerTest,LearningDemoIntegrationTest,LearningRecordsServiceTest,LearningAccessTest,CourseEnrollmentControllerTest,ProfileControllerTest,ProfileServiceTest,JwtAuthorityRefreshTest' test` in backend | 52 passed; 0 failed/errors; 0 skipped |
| `git diff --check` | Passed; existing line-ending notices only |
| Protected-file hash comparison | All 27 protected files unchanged, including the existing database file |

Backend database tests use a unique, dynamically supplied `jdbc:h2:mem:learning-isolated-<UUID>`
URL, disposable test DDL, and a JPA slice without application startup initializers.
They verify four-course creation, generated IDs/timestamps, rerun preservation,
enrollment duplicate protection, two users, cancellation ownership, real Learning
mapping, unavailable progress, and Course CRUD/active-state/permission behavior.
No production or shared datasource was used.

The first frontend run exposed five stale tests asserting local/fabricated Learning
behavior; those assertions were updated while retaining the existing Course import
and mapping tests. An additional test regex was corrected to inspect visible text
rather than CSS percentages. Initial sandboxed backend runs stalled on a Windows
JVM attach-pipe restriction and were stopped; the targeted command above passed
outside the sandbox. An initial XLSX probe needed test-session cleanup after an
expected failed import; the corrected isolated suite passed.

### Existing XLSX limitation, not a successful backend round trip

The unchanged Course entity lacks the generic import/export annotations. An isolated
probe reproduced backend export rejection (`@ExportEntity` missing) and a failed
import row because `name` is not mapped. These are explicitly tested existing
limitations, not successful XLSX functionality. They were not repaired because that
requires Course-owned changes. Course Management's browser-side XLSX code is
unchanged, and its existing sample-workbook/mapping tests pass. No publication
workflow exists in the current backend to regression-test; active-state CRUD was
tested instead.

### Browser verification

Used the actual Learning components with an explicit isolated fixture whose Axios
adapter intercepts every request. This is UI verification, not a claim of a live JWT
browser-to-database end-to-end run. The fixture never contacts a real backend.

Observed: direct click and one POST; pending/disabled state; exact success toast;
green badge and Continue learning; My Learning metadata; refresh; fixture logout/
login; second-account isolation; error toast without enrollment; admin-only
restrictions; real-course report with unavailable metrics; authorized view switching;
search/sorting; desktop and 390px mobile layout without horizontal page overflow.
No end-to-end browser test was run against an existing/shared application or retained
database. The full unrelated backend suite was not run.

Screenshots are fixture evidence:

![Desktop Catalog](learning-verification/catalog-desktop.jpg)

![Mobile Catalog](learning-verification/catalog-mobile.jpg)

The preview server was stopped and the temporary browser viewport override reset.
For future manual QA, run frontend Vite on a separate loopback port and open
`/tests/fixtures/learning-preview.html`. The toolbar selects fixture accounts and
can force enrollment failure. Its session storage contains only disposable fixtures.

## 8. Exact files changed or added by this task

Paths below are absolute. Existing user changes outside these task-specific edits
were not discarded. The final Git status also includes those pre-existing changes.

| Path | Change |
| --- | --- |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/backend/src/main/java/com/example/starter_project_2025/system/learning/LearningRecordsService.java | Add actual Course description to Learning mapping |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/backend/src/main/java/com/example/starter_project_2025/system/learning/demo/LearningDemoCourseInitializer.java | Add isolated opt-in four-course loader using Course Service |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/backend/src/test/java/com/example/starter_project_2025/system/learning/demo/LearningDemoCourseInitializerTest.java | Add activation, target, duplicate, metadata, and context-restoration tests |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/backend/src/test/java/com/example/starter_project_2025/system/learning/demo/LearningDemoIntegrationTest.java | Add isolated real-service persistence, enrollment, CRUD, and XLSX limitation checks |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/src/pages/management/demo/enrollment/CourseEnrollmentsPage.tsx | Replace local Learning data/actions with API-backed Catalog and honest report state |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/src/pages/management/learning/LearningCoursesEntry.tsx | Add view adapter preserving existing Admin Course Management |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/src/pages/management/learning/learning-catalog.api.ts | Add Learning adapter over existing Course, Lesson, and enrollment contracts |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/src/pages/management/learning/learning-enrollment.ts | Add request deduplication, confirmed cache updates, and session-race protection |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/src/pages/management/learning/components/CourseCard.tsx | Display actual metadata; remove local progress/completion/enrollment mutations |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/src/pages/management/learning/components/LearningRecordsPanel.tsx | Use real personal/target Learning records; remove local merge and invented metrics |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/src/pages/management/learning/learning-records.utils.ts | Map only supported enrollment fields |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/src/pages/management/learning/learning.types.ts | Carry description and thumbnail in Learning card model |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/src/pages/management/profile/index.tsx | Gate Learning Overview only through actual Learning access |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/src/components/layout/HeaderRight.tsx | Remove local-enrollment override of Learning menu permissions |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/src/router/component-registry.ts | Wire existing /courses route through Learning-owned view adapter |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/tests/course-import-sync.test.mjs | Update obsolete local Learning assertions; retain Course-side tests |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/tests/learning-enrollment.test.mjs | Add API lifecycle, isolation, mapping, UI, route-boundary, and Lesson aggregation tests |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/tests/fixtures/learning-preview.html | Add browser-only isolated fixture entry |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/frontend/tests/fixtures/learning-preview.tsx | Add intercepted API fixture for UI verification |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/docs/learning-verification/catalog-desktop.jpg | Desktop verification image |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/docs/learning-verification/catalog-mobile.jpg | Mobile verification image |
| D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature/docs/learning-integration-implementation-report.md | This report, launch instructions, limitations, and final Git status |

## 9. Final Git status

The exact final `git status --short` output is appended below. No staging or commit
was performed. Course-owned paths shown as modified/untracked were already present
at task start and passed the unchanged-content check.

```text
 M backend/src/main/java/com/example/starter_project_2025/init/RoleDataInitializer.java
 M backend/src/main/java/com/example/starter_project_2025/init/UserDataInitializer.java
 M backend/src/main/java/com/example/starter_project_2025/system/learning/LearningRecordsService.java
 M backend/src/main/java/com/example/starter_project_2025/system/profile/ProfileServiceImpl.java
 M backend/src/main/java/com/example/starter_project_2025/system/profile/dto/UpdateProfileRequest.java
 M backend/src/test/java/com/example/starter_project_2025/controller/ProfileControllerTest.java
 M backend/src/test/java/com/example/starter_project_2025/service/ProfileServiceTest.java
 M frontend/src/App.tsx
 M frontend/src/api/features/profile.api.ts
 M frontend/src/components/layout/HeaderRight.tsx
 M frontend/src/components/layout/NavMain.tsx
 M frontend/src/pages/management/dashboard/index.tsx
 M frontend/src/pages/management/demo/course/index.tsx
 M frontend/src/pages/management/learning/components/CourseCard.tsx
 M frontend/src/pages/management/learning/components/LearningRecordsPanel.tsx
 M frontend/src/pages/management/learning/learning-records.utils.ts
 M frontend/src/pages/management/learning/learning.types.ts
 M frontend/src/pages/management/profile/components/PersonalInfoCard.tsx
 M frontend/src/pages/management/profile/components/ProfileHeader.tsx
 M frontend/src/pages/management/profile/index.tsx
 M frontend/src/pages/management/profile/types.ts
 M frontend/src/router/component-registry.ts
?? backend/src/main/java/com/example/starter_project_2025/system/learning/demo/
?? backend/src/test/java/com/example/starter_project_2025/system/learning/
?? data/
?? docs/learning-integration-implementation-report.md
?? docs/learning-verification/
?? frontend/src/contexts/CourseContext.tsx
?? frontend/src/pages/management/demo/course/components/
?? frontend/src/pages/management/demo/course/mockData.ts
?? frontend/src/pages/management/demo/course/types.ts
?? frontend/src/pages/management/demo/enrollment/CourseEnrollmentsPage.tsx
?? frontend/src/pages/management/demo/enrollment/components/
?? frontend/src/pages/management/learning/LearningCoursesEntry.tsx
?? frontend/src/pages/management/learning/learning-catalog.api.ts
?? frontend/src/pages/management/learning/learning-enrollment.ts
?? frontend/tests/course-import-sync.test.mjs
?? frontend/tests/fixtures/
?? frontend/tests/learning-enrollment.test.mjs
?? frontend/tests/profile-edit-workflow.test.mjs
```
