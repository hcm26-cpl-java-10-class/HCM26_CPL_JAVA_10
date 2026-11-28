# Course Management fixes: integrated validation, 2026-11-28

Implementation delivered on 2026-11-27; reviewed and validated again on 2026-11-28 in the existing `feature/course-progress` worktree.

## Source and integration

- Verified the final revision-2 delivery ZIP against SHA-256 `87a59f607b08be876e03c88323b9608cd42da9cec6fc3d8524011fda6e3eb5e4` and its final source folder. The original Downloads ZIP was unavailable; the known pre-fix Git revision was used for comparison instead.
- Fetched both explicit remote refs. Remote feature was `aaa672504de63be74ad9344d1a4f6ea28744c55f`; fast-forwarded it to integrated dev `3bca03e9fb2035245ff811810a671631313f9a12` before applying fixes. All 20 delivery source/test paths matched the pre-fix Git baseline in current dev, ignoring line endings. Transferred those paths individually.
- Reviewed only task source, tests, this report, and the documentation index. No dependency, build configuration, backend production, schema, workbook, cover, upload, hierarchy fixture, or initializer changes. The intentionally removed visual course map remains removed.

## Resulting behavior

| Area | Change |
|---|---|
| Assessment management | Visible course return action; validated internal context survives Questions, Grading, Invitations, Statistics and Edit. Direct entry resolves the saved course relationship; standalone assessments fall back to the assessment list. Existing lifecycle actions and dirty-edit confirmation remain available. |
| Shared assessment form | Shared label/control/helper grid tracks align Question Format with Access Code and Passing Score with Max Score. Dialog header/footer remain outside the scrolling body; defaults, payloads, scoring and validation are unchanged. |
| Curriculum | Reads existing course assessments, filters by real section ID, separates course-level assessments, and deduplicates by assessment ID and real lesson relationship. Section-only assessments render without manufacturing Lesson records. Counts, ordering and duration units are preserved. Loading errors offer retry. |
| Course detail | One Edit weights action; weight controls align with the adjacent action. Back to Curriculum sits immediately before Manage assessment links and passes course/section context without a lesson-preview parameter. Explicit Q&A notification deep links still work. |
| Refresh behavior | Shared invalidation refreshes course outlines, details, assessment plans, links, lesson lists, available assessments and exam details after relevant mutations. Curriculum configuration actions lead through course detail to questions and weights. |

Student/guest views do not fetch management assessment data. Backend authorization, ownership, question snapshots, attempts, weights, scores and results remain governed by existing services.

## Necessary integration repairs

1. A new regression failed before the weight-save fix: the cached `course-detail` outline was not invalidated. Weight saving now uses the shared invalidation helper; the regression passes.
2. The fetched dev version of `ExamPreparationServiceTest.java` contained broken declarations, setup, helper and first-test syntax. The unchanged integrated baseline failed Maven test compilation. Restored that prefix from the last compiling feature revision, preserving all six subsequent test bodies from dev. All seven tests now compile and pass. No production backend behavior was changed.

## Fresh validation

| Check | Actual result |
|---|---|
| Frontend targeted regression suite | **97 passed in 18 files**, including navigation, unsafe return destinations, dirty edits, form defaults/validation, curriculum relationships/errors, query refresh, recommendations, notifications, student preparation and role state. |
| TypeScript project build | Passed. |
| Frontend production build | Passed, 3,961 modules. Rollup emitted third-party annotation and large-chunk warnings. |
| Backend targeted tests and compilation | **125 passed, 0 failures/errors/skips**, including assessment creation, course linking, outcomes/completion, access guards, configuration, results, notifications, persistence and preparation. |
| Fresh isolated startup | Production classes started with normal initializers; authenticated readiness returned `UP`. Ten starter courses present. Required hierarchy-demo source fixtures unchanged. |
| Real API checks | Section-only, lesson-linked, course-level and standalone assessments read correctly. Link, unlink and relink preserved assigned question snapshot IDs and assessment configuration. Lesson-linked assessment appeared once. Duration minutes/seconds verified. Student link mutation and atomic assessment creation returned 403. |
| Browser checks | Dark desktop creation controls measured equal top positions and 36px heights for Format/Access Code and Passing/Max Score; dark mobile dialog remained usable with header/footer visible. Light desktop course/curriculum flow verified. Returning with section context opened the section with zero dialogs, without Q&A. Grading preserved return context and returned to course assessments. |
| Whitespace and documentation | `git diff --check` and `node scripts/check-docs-rule.mjs --ci` passed before commit. |

### Commands and validation configuration

Reused installed dependencies after verifying package/lockfile compatibility. Temporary local config wrappers mirrored the tracked Vite plugins, alias and Vitest settings, moving caches, TypeScript build info and output to disposable task storage. They were not staged. In the commands below, `$VALIDATION_ROOT` denotes that local task directory.

From `frontend`:

```text
node node_modules/vitest/vitest.mjs run --config push-validation.vitest.config.ts --configLoader runner --maxWorkers=2 src/utils/assessment-navigation.test.ts src/utils/assessment-queries.test.ts src/utils/assessment-result.test.ts src/utils/learning-curriculum.test.ts src/pages/management/exam/ExamDetailPage.test.tsx src/pages/management/exam/ExamConfigFields.test.tsx src/pages/management/demo/lesson/components/SectionLessons.test.tsx src/pages/management/demo/curriculum/index.test.tsx src/pages/management/demo/lesson/components/ConfigureAssessmentLink.test.tsx src/pages/management/demo/course/components/CourseAssessmentPanel.test.tsx src/pages/management/exam/curriculum/ExamCurriculumPage.test.tsx src/components/layout/NotificationBell.test.tsx src/pages/student/StudentExamPreparationPage.test.tsx src/utils/recommendation-session.test.ts src/pages/student/RecommendedCoursesPage.test.tsx src/pages/management/demo/course/components/CourseRecommendations.test.tsx src/pages/management/demo/course/components/recommendation-filters.test.ts src/store/slices/auth/authSlice.test.ts
node node_modules/typescript/bin/tsc -b $VALIDATION_ROOT/tsconfig.build.json
node node_modules/vite/bin/vite.js build --config push-validation.vite.config.ts --configLoader runner --outDir $VALIDATION_ROOT/frontend-dist
```

From `backend`:

```text
mvn -o -Dtest=AssessmentLessonControllerTest,CourseAssessmentServiceTest,CourseAssessmentOutcomeTest,CourseAssessmentCompletionServiceTest,ExamCourseLinkServiceTest,CourseExamControllerTest,ExamAccessGuardTest,ExamConfigValidatorTest,ExamServiceImplTest,ExamResultAccessServiceTest,NotificationServiceTest,CourseExamLinkPersistenceTest,ExamPreparationServiceTest,ExamProgressLockServiceTest,LearnerExamAuthorizationTest -Dspring.mail.host=127.0.0.1 -Dspring.mail.port=1 -Dapp.notification.email-outbox-enabled=false -Dapp.qna.email-notifications-enabled=false test
```

Runtime used a disposable file H2 database and loopback services. Email outbox/Q&A mail, scheduling, AI and translation were disabled only in disposable runtime properties. Production initializers and source configuration were unchanged. No real/shared database was used.

## Limits

The entire repository test suite was not run; only the targeted suites above are claimed. Visual checks used the available Chromium browser, not every browser. Local full-page reload authentication was affected by the localhost/loopback validation setup; authenticated application navigation was used for the checked flows. No authentication code was changed. Git ancestry and GitHub comparison establish conflict readiness at verification time; CI, required reviews and branch protection are separate. No PR was created or merged by this task.
