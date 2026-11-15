# Course Management ↔ Assessment Management

## What is connected

Course, section and lesson links use the existing assessment system. Adding a Quiz, Exam or Assignment lesson opens the shared assessment creation form, saves both records in one transaction and derives their course/section/lesson links on the server. Questions, attempts, grading, result publication and appeals remain in Assessment Management.

The Course Details page and Assessment Management → Curriculum Mapping now share an **Assessments and course grading** panel. It shows linked assessments, each weight, the total, plan issues, links to assessment settings/questions/results, and enrolled learners' final course grades. Use Refresh after changing assessment settings or publishing results.

## Grading policy

- Every linked assessment must have an explicit weight; 0 means practice. The course's weights must total exactly 100% before assessed learning can start and final course grades can be calculated. Authors can build an incomplete plan while preparing the course.
- Weighted assessments must be active and have active questions. Active assessment lessons must have matching linked assessments. Publishing a draft course uses the existing publishing validator plus the assessment-plan checks.
- Final course grade, out of 10, is `sum((best fully graded attempt score / that attempt's maximum score) × 10 × assessment weight / 100)`.
- Retakes use the best normalized, fully graded attempt. In-progress and pending-manual-review attempts do not contribute. An expired attempt counts only when it has a final score and submission timestamp, matching the existing assessment publication policy. Attempt maximum-score snapshots protect normalization when an assessment's scale changes later.
- The total is rounded once to two decimal places. The existing course pass threshold remains 5.00/10; assessment-specific pass scores remain separate. Passing every individual assessment is not an additional course requirement.
- No final grade or pass/fail is shown until all positive-weight assessments have final scores and their results are published with a visible release policy. Missing results are not silently rescaled. Practice assessments do not affect the final grade or block its calculation.
- Plan incomplete, assessments in progress, awaiting published results, passed and failed have distinct learner-facing states. My Scores, course grade details, staff results and student analytics use the same calculation and publication rules.
- Courses with no assessments keep lesson-only completion and do not receive an invented academic score. Existing course assessments with unset weights require explicit configuration; the old automatic category percentages are no longer used.
- Grades reflect the current course assessment plan. Changing weights or links recomputes aggregate grades; original attempt scores remain intact. Configure plans deliberately before running assessed courses.

## Progress and certificates

For an assessment lesson, students complete preceding lessons in its section to unlock the assessment. They do not need to mark that assessment lesson complete before taking its own assessment. Normal resource lessons and section-level prerequisites retain their existing access rules. Enrollment and the existing invitation/password requirements still apply.

Assessment lessons complete automatically after their matching linked assessments have fully graded, published results. The manual lesson-completion endpoint also enforces this rule; a student cannot bypass an assessment by checking off the lesson. Grade publication refreshes eligible learners' progress, and loading the learning page refreshes eligibility after later score changes.

Course completion and certificates require all active lessons to be completed and, for assessed courses, a complete plan and a passing final grade. Lesson progress can reach 100% while academic requirements are still pending or failed; the UI shows these separately. Course-completed notifications and certificate links use the combined completion state.

Certificate issuance, learner certificate lists, enrollment certificate lookup and public verification check the same current eligibility. Withdrawn/hidden results or a failed/pending course grade cannot produce a currently valid completion certificate. Historical certificate records are retained.

## Permissions and API

- `GET /api/courses/{id}/assessment-plan`: plan readiness, total weight and issues; requires course-update or exam-read permission and instructor/admin course access.
- `GET /api/courses/{id}/assessment-results`: enrolled learners and final-grade states; requires course-report-read or exam-read permission and instructor/admin course access.
- Existing learner My Scores and learning-progress endpoints keep ownership checks. Progress adds `courseCompleted`, `assessmentStatus`, and `overallScore`.
- Existing exam requests/responses keep `courseWeight`; omitted preserves it, null clears it, and 0 means practice. Both normal saves and separate curriculum links enforce the 100% allocation ceiling and lesson-category matching.
- Quiz lessons match Quiz assessments, Assignment lessons match Assignment assessments, and Exam lessons match Midterm or Final Test assessments.
- Combined creation still requires `LESSON_CREATE` and `EXAM_CREATE`; teachers retain existing assessment ownership and instructor-link restrictions.

## Course Releases removal

Course Releases V1's entities, repositories, service, controller, menu registration, frontend page, route, tests and guide have been removed. Startup deactivates `/course-releases` in existing menu records. Prior database release records are not dropped, and the original source ZIP is unchanged. The generated testing ZIP excludes `.git`, `node_modules`, `target` and `dist`.

## Manual acceptance test

### Compatibility with the current dev branch

This update is prepared on dev commit `4e6dbe0e249a55b5fd8f755c48fc80efebce6d1b`. It retains dev's Score Management page, saved gradebook snapshots, course thumbnails, assessment edit locks, guest access rules and course-final prerequisite checks.

An explicitly saved Score Management snapshot remains the published grade source for My Scores, staff learner grades and completion checks. Missing positive-weight scores remain pending. When scanning a fresh gradebook, a complete assessment allocation totaling 100% initializes the columns with the creators' configured weights. Scanning an existing gradebook preserves edited weights and manual scores; new columns retain dev's 0% default so teachers can adjust them. Courses using the legacy unconfigured allocation retain dev's category-based scan defaults.

Use the supplied patch to transfer changes into Git. Do not overwrite a Git checkout with the testing ZIP: the patch excludes database files, uploads, dependencies and other teams' unrelated work. No existing database tables or records are dropped by this update.

For a compatibility check, scan a fresh course with Quiz 20% and Final 80%; verify those weights. Change existing gradebook weights to 35% and 65%, scan again, and confirm the edits remain. Save a complete score snapshot, then verify the learner's My Scores and course learner grades agree. An unsaved gradebook edit must not change the learner's published snapshot.

1. Extract the updated ZIP to a fresh folder. Start backend and frontend from that copy. Sign out/in to refresh the menu; Course Releases should be absent.
2. As the course instructor or admin, prepare a test course with an introductory lesson, a Quiz lesson and an Exam lesson. Use the shared creation forms; add questions through Assessments.
3. Set the Quiz weight to 20% and the Exam weight to 80%. Open Course Details or Curriculum Mapping. Confirm the plan is Ready and links point to the right course/section/lesson. An incomplete total or missing weight/questions should show an issue and prevent a new assessment attempt.
4. Enroll a student and use the normal invitation flow. Confirm the Quiz is blocked until its preceding introductory lesson is completed. It should then open without manually completing the Quiz lesson itself.
5. Score the Quiz 10/10 and the Exam 50/100. Leave one result unpublished. My Scores must not show a final grade or Passed yet. Pending manual grading must also prevent finalization.
6. Publish both graded results. Expected course grade: `10 × 20% + 5 × 80% = 6.00/10`, Passed. Confirm the same result in My Scores, grade details, the staff course panel and analytics. The assessment lessons should complete automatically.
7. Once all active lessons are complete, confirm a certificate is issued and verifies as valid. Repeat with a final grade below 5/10; no completion certificate should become eligible. Hiding/unpublishing a contributing result should remove current certificate eligibility.
8. Test a 0% practice assessment, a better retake, an unfinished retake and a pending manual grade. Only the best fully graded result contributes; practice does not change the final grade.
9. Test a different instructor and a non-enrolled student. Existing ownership, course-scope and learner-access rules must prevent unauthorized changes or access.

## Verification

Frontend production build and clean backend package build are required. Focused regressions cover individual weights, missing/hidden results, retakes and score snapshots, pass threshold/rounding, access prerequisites, automatic assessment-lesson completion, certificate gates, atomic creation/rollback and existing course/assessment behavior. A persistence-backed analytics regression checks parity with learner grades and hidden results. No browser or desktop control is used.

## Course navigation and student catalog update

Opening an assessment through the course grading panel preserves the originating course or curriculum-mapping page. The assessment header's Back button returns to that page and its grading section. This destination is retained across assessment tabs and page refreshes. Direct visits from Assessments still return to the assessment list.

Student course cards now show **View detail** above Enroll, Continue learning or View certificate. Actual student accounts and the Student View preview use the same catalog cards. Existing active/published catalog visibility rules and publishing controls are unchanged.

Navigation regression: `node scripts/check-assessment-navigation.mjs`. Manual check: open an assessment from course details, change its tab, refresh, then use Back to course. Open Assessments directly and confirm its Back button still returns to the assessment list. In Student View, confirm View detail opens the course overview without enrolling, and Enroll still works separately.

## Student assessment outline and learner-grades page

Course details now include safe metadata for active assessments linked at the course, section or lesson level. Section-linked quizzes and exams appear under that section even if no separate Quiz lesson was created. Lesson-linked assessments appear under their lesson, and course-level assessments have their own group. Titles, categories, weights and durations are visible before enrollment; questions, answers, passwords and scores are not included in this catalog response. Inactive assessments and assessments in inactive outline locations are excluded. Enrolled learners can open assessments through the usual guarded taking page. Enrollment, invitation and prerequisite checks remain in force.

**View learner grades** now opens `/courses/{id}/grades`. It displays 10 learners per page, with a search box for name/email/learner ID and a grade-status filter. Search is accent-insensitive. Filters apply to the full authorized course roster before pagination. Search, filters, page and return destination are stored in the URL. The existing instructor/admin authorization remains on the results API; adding student email does not expose the roster to students.

Manual checks: open student Course Details before enrollment and expand the sections containing your linked Quiz/Midterm. Confirm the assessment names, weights and durations appear, with enrollment guidance. Enroll and verify Open assessment still enforces the normal access rules. As instructor/admin, click View learner grades and confirm a separate page opens; for 50 learners it should have five pages of 10. Try a name/email search, Passed/Pending status filters, Next/Previous, Clear filters, refresh and Back to course. Run `node scripts/check-learner-grades.mjs` for the search/filter/pagination regression checks.
