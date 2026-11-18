# Course AI and learner assessment fixes — November 16, 2026

Source: HCM26_CPL_JAVA_10-dev.zip, SHA256 19f64e51c08f010ee08d2258d05336f938e361feaed4b15ff2913ecb1c635377.

## Changes

- Course recommendation prose and saved assistant messages display names without ID labels. IDs remain on validated course objects. Provider instructions keep IDs in the structured selection, and ID-bearing provider prose receives neutral guidance instead. React renders all untrusted text as text.
- The inline AI chooser has a highlighted heading, starter questions, distinct messages, a multiline input, keyboard support and loading feedback, with English/Vietnamese text and light/dark styles. The existing floating assistant is unchanged.
- Automatic, fallback and AI selections support a bounded shortlist of up to 30 courses. The learner sees at most six cards on each page. Search, preferences, dismissal, enrollment and changed result counts reset or clamp the page.
- New /student/exams/:examId/prepare overview uses GET /api/exams/:examId/preparation. It does not create, expire, grade or save an attempt. It exposes only allowlisted metadata and the authenticated learner's permitted result summaries. It shows configured pass requirements, counts, attempts, integrity requirements, active deadlines and permitted review actions.
- Only the explicit Start/Resume action invokes the existing attempt POST. Loading /take uses an existing-attempt endpoint that cannot allocate an attempt. Existing timing, password, invitation, progress, enrollment, grading and publication logic remains in effect.
- Course and invitation entry points open preparation. Course return context survives preparation, taking, essay/coding workspaces, submission and review. Management return-path defaults are unchanged.
- Breadcrumbs build links from the full URL while hiding display-only student/identifier segments. Actual students and Admin Student View cannot navigate into assessment management. Backend CRUD, export, question-pool, management link metadata and legacy question-preview routes have role restrictions. Explicit CRUD method overrides protect inherited controller methods.
- Two old backend test fixtures now supply missing question-pool/grade-scale mocks; production grading and statistics implementations are unchanged.

This project has no current assessment instructions field or configured scheduled opening/closing times. The overview does not invent those policies. Its only displayed deadline is the existing attempt deadline.

## Verification actually performed

- Frontend production build: PASS (TypeScript and Vite). Existing third-party annotation and large-bundle warnings remain.
- Final focused frontend checks: 28 PASS across recommendation text/history, six-card pages, preferences/dismissal/enrollment changes, stale cancellation, preparation/start/resume, unpublished submissions, course return context, student breadcrumbs and management route blocking.
- Full frontend sweep: 306 PASS, 15 FAIL (321 total at that run). The same 15 failures reproduced against the original ZIP source in Trainee Import (5), Class Calendar (4), and Class Readiness Navigation (6). These unrelated failures remain; the entire frontend suite is not green. Three additional focused checks were added afterwards and passed in the final focused run.
- Backend regression checks: latest results for 37 related suites total 260 PASS, 0 failures/errors. Coverage includes recommendations, preparation, authorization, explicit starts, attempts, question/pass-score snapshots, grading, integrity, passwords, publication, progress, enrollment, certificates, persistence and peer review. The broad run initially found the inherited CRUD guard gap and stale statistics test fixture. After corrections, the affected suites were rerun; their latest results pass.
- Final Maven package: PASS with 44 selected affected checks, using Java 21 and the local dependency cache. The executable JAR was produced and intentionally excluded from this source ZIP.
- Comparison with the original ZIP: no original files removed. Only the intended frontend/backend source and tests differ. Data, uploads, resources, dependency lockfiles, and unrelated project/workspace files match the original. No Git checkout, commit, push, merge or PR operation was performed.
- Tests use mocks/local provider fixtures and isolated in-memory H2 databases; no user database was used.

The backend package command was:

    mvn -o -B -Dtest=LearnerExamAuthorizationTest,ExamResultStatisticsServiceTest,ExamPreparationServiceTest,ExamAttemptServiceTest,CourseExamControllerTest package

The broader regression selection was:

    mvn -o -B -Dtest=Exam*Test,LearnerExamAuthorizationTest,Recommendation*Test,CourseExamControllerTest,*Certificate*Test,*CourseAssessment*Test,*Enrollment*Test,*Progress*Test package

## Manual testing

1. Use a testing database and normal project setup. Sign in as an actual student. In Recommended for you, open the AI guide, try English and Vietnamese, reload an older conversation, and confirm IDs are absent. Test Enter, Shift+Enter, loading, Clear chat, account switching and the existing floating assistant.
2. With more than six eligible matching courses, page automatic results and an AI selection containing more than six. Check fewer than six, exactly six, empty, search, preference edits/reset, dismissals and enrollment. There must be at most six cards, valid links and no empty out-of-range page. Up to 30 eligible results are intentionally retained, not the entire catalog.
3. From a course lesson, course detail, exam list and invitation, open an assessment. Repeatedly opening/reloading preparation must leave attempt count, startedAt and deadline unchanged. Check requirements and Back to course, including the original lesson.
4. Start explicitly, answer multiple-choice/essay/code questions, reload, leave and resume. Check autosave and the original running deadline. Finish and return to the course. Test password-protected, locked, unavailable and exhausted-attempt cases. An old direct /take URL without an attempt must not create one.
5. Test unpublished and published results with permitted/restricted submission review. Confirm unpublished scores, correct answers, grading details and passwords are absent from preparation responses. Verify feedback navigation returns to the course, and normal course completion/certificates still work.
6. Check student breadcrumbs keep /student/exams and other full student routes. Try /exams, its detail/edit/question routes, management exports/question-pool APIs, and management link metadata as a student: access must be denied or redirected. Repeat Admin Student View UI checks; backend identity remains the authenticated admin. Check teacher/admin management still works.
7. Review responsive layout, keyboard focus and contrast in light/dark themes.

## Limits

No browser or desktop was controlled, and no interactive visual/end-to-end browser testing was performed. No live external AI provider request was made. Camera/fullscreen behavior, real email, live databases and real certificates should receive the manual smoke checks above before deployment. This testing ZIP is not a production deployment.

## Follow-up: student navigation overflow menu

The earlier wrapping layout has been replaced with a single desktop navigation row. A More (ellipsis) dropdown follows System Management and holds later groups such as Training Management. A ResizeObserver measures the available navigation width and menu labels; earlier groups also move into More as available space shrinks. Account controls keep their reserved width. The existing compact-screen navigation dropdown, permissions, active states, invitation badges and role switching remain available. Overflow entries retain their group headings and original navigation actions.

Validation: three runnable overflow-sizing checks pass (wide-screen cutoff, shrinking/expanding space, exact fits, no entries and wider labels). Frontend TypeScript/Vite production build passed. No browser or desktop was controlled. Manually check the ellipsis at the supplied wide-screen size, narrower desktop sizes and browser zoom; open overflow items and confirm navigation, active styling and role switching for both actual students and Admin Student View. Check compact screens and light/dark themes. Earlier backend/assessment checks were not rerun for this frontend-only follow-up.

## Verification in the actual feature checkout before Git handoff

Transferred only the reviewed task changes onto feature/course-progress, keeping its existing registry routes and documentation layout. No branch synchronization or dev merge was performed. The original ZIP verification above is a separate run.

Fresh results in C:/Users/Admin/Downloads/HCM26_CPL_JAVA_10-M6-git: 241 related backend tests passed with zero failures, errors or skips; Maven packaging succeeded. All 31 frontend tests available in this feature checkout passed, and the frontend production build succeeded. This older checkout does not contain the other frontend suites from the newer project ZIP, so the earlier ZIP-wide 321-test result is not a claim about this branch.

The feature checkout needed the frontend test runner, DOM test dependencies, Vitest configuration and setup to run the new checks. Its package manifest and lockfile intentionally include that integration change. No production package was added. The backend test process used isolated in-memory H2 databases. No interactive browser or live external AI-provider testing was performed.
