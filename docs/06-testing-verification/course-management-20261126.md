# Course covers and assessment configuration — 2026-11-26

## 1. Result

Final scope: generated course covers and direct Curriculum assessment configuration. Source was matched against the final tested archive, then integrated with dev at `44ccecfa84e2fe5c17c8c0f3bf9a6e17a46e3edf` by fast-forward in the existing feature/course-progress checkout. The category relationship constraint and current notification behavior from dev are preserved.

Covers: authorized canvas previews, Orbit/Bands/Grid styles, variations, manual images and image URLs. The selected preview is uploaded only during course save. Java AWT/ImageIO generates missing covers during saves, startup backfill and real workbook/CSV imports. Course titles, category name/code and actual levels drive the design. Vietnamese names and missing metadata are supported. Existing covers and metadata are preserved; content-addressed PNG storage deduplicates retries and safely cleans rollback/replaced images while retaining shared/manual files. Requests are bounded to 2 MB and 16 million decoded pixels; selected image data is transient/write-only and only normal thumbnail URLs persist. Student catalog reads do not write images.

Assessment configuration: saved QUIZ/EXAM/ASSIGNMENT lessons link from Curriculum/editor to the exact course assessment card. The matching assessment is focused/highlighted, direct weight editing selects its input, and the existing question editor receives a return route. Curriculum return restores the section/lesson context. Unsaved and missing-link states provide guidance through the existing workflow. Existing permissions, staff-view restrictions, ownership, publication and grading rules are retained.

Integration correction: two NotificationServiceTest failures reproduced on clean unchanged dev (6 tests, 2 failures). Its mocks used the old writer overload. Three mock/verification calls now target the current tenant-aware overload; duplicate recovery and non-duplicate error propagation assertions remain intact. Production notification code is unchanged.

## 2. Changed files

- [backend/src/main/java/com/example/starter_project_2025/system/demo/course/Course.java](../../backend/src/main/java/com/example/starter_project_2025/system/demo/course/Course.java)
- [backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseBundleImportService.java](../../backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseBundleImportService.java)
- [backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseCoverBackfill.java](../../backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseCoverBackfill.java)
- [backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseCoverCleanup.java](../../backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseCoverCleanup.java)
- [backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseCoverListener.java](../../backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseCoverListener.java)
- [backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseCoverService.java](../../backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseCoverService.java)
- [backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseDTO.java](../../backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseDTO.java)
- [backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseMapper.java](../../backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseMapper.java)
- [backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseRepository.java](../../backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseRepository.java)
- [backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseServiceImpl.java](../../backend/src/main/java/com/example/starter_project_2025/system/demo/course/CourseServiceImpl.java)
- [backend/src/main/java/com/example/starter_project_2025/system/upload/FileStorageService.java](../../backend/src/main/java/com/example/starter_project_2025/system/upload/FileStorageService.java)
- [backend/src/test/java/com/example/starter_project_2025/system/demo/course/CourseBundleImportServiceTest.java](../../backend/src/test/java/com/example/starter_project_2025/system/demo/course/CourseBundleImportServiceTest.java)
- [backend/src/test/java/com/example/starter_project_2025/system/demo/course/CourseCoverServiceTest.java](../../backend/src/test/java/com/example/starter_project_2025/system/demo/course/CourseCoverServiceTest.java)
- [backend/src/test/java/com/example/starter_project_2025/system/notification/NotificationServiceTest.java](../../backend/src/test/java/com/example/starter_project_2025/system/notification/NotificationServiceTest.java)
- [docs/06-testing-verification/course-management-20261126.md](../../docs/06-testing-verification/course-management-20261126.md)
- [frontend/src/components/datatable/modal/form/FormModal.tsx](../../frontend/src/components/datatable/modal/form/FormModal.tsx)
- [frontend/src/pages/management/demo/course/components/CourseAssessmentPanel.test.tsx](../../frontend/src/pages/management/demo/course/components/CourseAssessmentPanel.test.tsx)
- [frontend/src/pages/management/demo/course/components/CourseAssessmentPanel.tsx](../../frontend/src/pages/management/demo/course/components/CourseAssessmentPanel.tsx)
- [frontend/src/pages/management/demo/course/components/CourseCoverEditor.test.tsx](../../frontend/src/pages/management/demo/course/components/CourseCoverEditor.test.tsx)
- [frontend/src/pages/management/demo/course/components/CourseCoverEditor.tsx](../../frontend/src/pages/management/demo/course/components/CourseCoverEditor.tsx)
- [frontend/src/pages/management/demo/course/index.tsx](../../frontend/src/pages/management/demo/course/index.tsx)
- [frontend/src/pages/management/demo/lesson/components/AssessmentLessonDialog.tsx](../../frontend/src/pages/management/demo/lesson/components/AssessmentLessonDialog.tsx)
- [frontend/src/pages/management/demo/lesson/components/ConfigureAssessmentLink.test.tsx](../../frontend/src/pages/management/demo/lesson/components/ConfigureAssessmentLink.test.tsx)
- [frontend/src/pages/management/demo/lesson/components/ConfigureAssessmentLink.tsx](../../frontend/src/pages/management/demo/lesson/components/ConfigureAssessmentLink.tsx)
- [frontend/src/pages/management/demo/lesson/components/LessonFormModal.tsx](../../frontend/src/pages/management/demo/lesson/components/LessonFormModal.tsx)
- [frontend/src/pages/management/demo/lesson/components/SectionLessons.tsx](../../frontend/src/pages/management/demo/lesson/components/SectionLessons.tsx)
- [frontend/src/types/common/datatable.ts](../../frontend/src/types/common/datatable.ts)
- [frontend/src/types/features/demo/course.ts](../../frontend/src/types/features/demo/course.ts)

The docs index links this report. Only explicit reviewed source/test/documentation paths are staged; credentials, environment files, runtime data, dependencies, builds, caches, logs and archives are excluded.

## 3. Database and routes

No schema migration or new database column. Existing thumbnail URLs and upload storage are reused. Course save/import APIs remain compatible; coverImage is a bounded write-only request field mapped to a transient entity property. Assessment deep links add assessmentLessonId/assessmentSectionId queries to the existing course detail route, reuse the question/weight editors, and return to Curriculum. The original course outline is retained.

## 4. Validation on integrated source

- Frontend: npm run build passed; 39 tests passed in six retained feature/regression files.
- Backend: mvn test selection passed 141 tests in 25 suites, no failures/errors/skips; mvn -q -DskipTests package passed. Selection included covers, bundle imports, courses, assessment outcomes/completion, assessment-link persistence, enrollment, progress, hierarchy fixtures, recommendations, notifications and email dispatch.
- Fresh isolated H2 startup reached authenticated readiness UP. Initial catalog had ten starter courses and twelve categories. SMTP was loopback-only; email delivery, scheduling, AI and translation were disabled.
- Coverless workbook import and repeat each succeeded for all 260 rows. Fourteen generated PNGs existed, were served, and retained identical references/file counts on repeat. Generic CSV/API import succeeded.
- Image-only save, idempotent retry, invalid-image 400 preservation, shared image retention and replacement cleanup passed. Student cover update returned 403; other-account progress returned 404. One quiz had exactly one correct course/section/lesson/assessment relationship. Read-only catalog/progress requests made no cover/progress writes.
- Browser: integrated category/level/Vietnamese cover previews, styles, variations, explicit selection and cancellation checked at 1280x900 desktop and 390x844 mobile in dark mode.
- Canonical workbook verified as 20 courses, 40 sections and 200 lessons, containing VIDEO/AUDIO/TEXT/DOCUMENT/LINK only. Dependency manifests/lockfile, workbook and hierarchy fixtures match dev, including payment-sdk.zip and its source files. No assessment starter lessons were added.
- Documentation rules and git diff --check passed before commit.

## 5. Limits and handoff

The user requested stopping remaining checks and proceeding to commit/push. Additional integrated restart, light-theme and live assessment-editor walkthroughs were not performed in this review. Automated navigation/focus/permission/weight tests and API relationship checks passed. The full repository suite, external delivery and load tests were not run. Vite reports a non-blocking large-chunk warning.

Only feature/course-progress is authorized for push; no PR is created or merged. Remote SHA equality, current dev ancestry and GitHub comparison are verified after push. Without an existing PR, its actual mergeability badge and review/protection requirements cannot yet be confirmed. Readiness can change as dev advances.

Existing dependencies and earlier deliverables are retained. Only task-owned processes and disposable validation builds/data/logs/caches are cleaned after push.
