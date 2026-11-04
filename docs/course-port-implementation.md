# Course module port — 2026-11-04

Source: `D:/FPT_OJT/HCM26_CPL_JAVA_10_course-management` (read only).
Destination: `D:/FPT_OJT/HCM26_CPL_JAVA_10_user-profile-feature`.

## Source analysis and adaptations

The full source file inventory is in `course-port-source-inventory.md`. The present source is newer than the supplied screenshots: Course Management uses AutoCrud and separate Catalog components. The destination therefore retains its screenshot-oriented table/cards while taking source bundle-import traversal, Category/Section modules, progress/certificate/question/report entities and presentation constants.

The destination already has Apache POI, XLSX, React Query, Axios, Radix and Lucide. No dependency/configuration replacement was needed. The source Lesson entity is Section-based and stores seconds; the destination Lesson remains in `online_lession`, retains its Course foreign key and minute field, and adds nullable Section/content fields and exact seconds. Existing User, Profile, authentication and personal enrollment implementations were retained.

## Implemented integration

- Source Category and Section CRUD packages were ported, with Lesson package references and Course category queries adapted.
- Course retains the previously added scalar Category Codes, Level, Publication Status and Instructor Email fields. A Category join table now supports the source dictionary and category usage checks. CRUD resolves category codes into dictionary entries. Known category codes are formatted using the screenshot taxonomy; unknown codes are preserved.
- Source CourseBundleImportService was adapted for the destination Course/User/Lesson model. Courses are processed before Sections and Lessons, preserving their relationships. Active Boolean values and exact lesson duration seconds are read from the workbook. ReadMe is documentation, not a data sheet.
- `POST /api/courses/import-bundle` accepts multipart `file` and `updateExisting` (default false). Creation requires COURSE_CREATE; opting into Course metadata updates also requires COURSE_UPDATE. Existing Sections and Lessons are always skipped. The normal `/api/courses/import` route uses the non-overwriting bundle flow.
- The preview detects full Courses/Sections/Lessons bundles and sends them to the backend. Import counts include records across all three sheets; created, updated, skipped and failed counts are separated. Sheet names and Excel row numbers accompany backend row errors. A database/commit failure is surfaced as an API error rather than a successful import. Course-only workbooks keep the existing CRUD-based path.
- Backend XLSX export is available through `/api/courses/export-bundle` and the EXCEL format of `/api/courses/export`. It exports ReadMe, Courses, Sections and Lessons from the backend. Unsectioned legacy lessons are included with a blank Section Title and an explicit ReadMe note; they must be assigned a Section Title before reimport.
- Course table Category pills, publication/level labels, sticky Actions, timestamp format and Auto row count were updated. Create/Edit preserves metadata and exposes Instructor Email. Category/Level/Instructor/Publication filters use actual records.
- Enrollment catalog retains direct POST /api/enrollments, backend-confirmed Enrolled/Continue learning and the exact success toast. It uses saved category labels and source Level colors, actual lesson counts and duration derived from exact seconds where available.
- `GET /api/course-enrollments` computes per-Course enrollment and progress reports from CourseEnrollment, active Lessons, LessonProgress and Certificate records. Access requires ADMIN_ACCESS and COURSE_READ. Unique learners, average progress, completed enrollments, completion rate and certificate totals are computed from these records. Active learners means an access record in the last 30 days. Empty confirmed datasets yield zero; failed/pending reads remain unavailable.
- Administrative report filters include instructor, category, level, publication status, learner/course search, department and inclusive enrollment date bounds. Department uses the destination User.department scalar. Filtering/pagination uses complete backend datasets rather than filtering just one backend page. CSV exports the filtered report.
- The Course sidebar includes Courses, Categories, Certificates, Curriculum, Enrollments, Unanswered Questions, Lesson Reports and Enrollment Logs for authorized administrators. Category/Curriculum use the destination AutoCrud routing. The other support pages read actual backend records through ADMIN-protected `/api/course-resources/{kind}` endpoints.

## Limits — this is not a full replacement of the source LMS

Certificates, Questions and Lesson Reports have entity/read-list integration here, not the source's complete issuance, discussion, voting, moderation or notification workflows. Enrollment Logs show persisted enrollment creation records, not an invented historical audit trail. The source lesson player/progress-writing workflow has not been transplanted; report completion values depend on records actually present in LessonProgress. Existing My Learning keeps its current destination behavior. These limitations mean the whole source LMS has not been ported in full, and runtime or visual parity has not been verified.

Metadata is not backfilled into old records automatically. A full workbook can update existing Course metadata only after the user enables the import checkbox; Course-only imports still skip/reject duplicates without overwriting. The 15-Course sample does not supply metadata for any original Course that is absent from its Courses sheet; edit those Courses or include them in an explicitly approved update import.

## Files affected by this port

Backend existing files: Course.java, CourseController.java, CourseFilter.java, CourseRepository.java, CourseServiceImpl.java; CourseEnrollmentRepository.java; online_lession/Lesson.java, LessonDTO.java and LessonRepository.java.

Backend new files: category/*.java and section/*.java copied/adapted from source; course/CourseBundleImportService.java, CourseBundleExportController.java; progress/LessonProgress.java and LessonProgressRepository.java; certificate/Certificate.java and CertificateRepository.java; qna/LessonQuestion.java and LessonQuestionRepository.java; lessonreport/LessonReport.java, LessonReportReason.java, LessonReportStatus.java and LessonReportRepository.java; report/CourseSyncReportController.java and CourseResourcesController.java.

Frontend: integrations/courses/course-data.ts, course-workbook.ts and new course-presentation.ts; course/index.tsx, components/CourseTable.tsx, CourseModal.tsx and ImportExportModal.tsx; enrollment/CourseEnrollmentsPage.tsx and new CourseResourcesPage.tsx; new category/index.tsx and section/index.tsx; learning/learning-catalog.api.ts; components/layout/Sidebar.tsx; router/component-registry.ts. No User Profile files were edited by this port.

## Verification and use

Only compilation/build checks were performed: `mvnw -DskipTests compile` and `npm run build`. Automated tests, backend startup, browser tests and database migrations were not run, as requested. Compilation is not runtime verification. Existing mapper/deprecation and frontend bundle-size warnings remain.

No source-project files, datasource configuration, existing database data, Git branch or commits were changed. The existing H2 file SHA-256 remained `55879f322e12203118fed29099ac28a1784c4d4312c9047e6f14c8501205a55b` at the end of implementation. Pre-existing unrelated working-tree changes remain in place.

To use: restart the backend so its existing schema-update configuration can add the new tables/nullable columns, refresh the frontend, open Course Import, select the multi-sheet XLSX and review the preview. Enable the metadata update checkbox only if existing Course metadata should be replaced by that workbook. Then import supported fields. Restarting was deliberately left to the user; no running/shared database was modified during implementation.
