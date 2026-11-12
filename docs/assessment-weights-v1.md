# Individual assessment weights and assessment lessons

## For course authors and the exam management team

Each assessment has its own `courseWeight` percentage. This is separate from its maximum score and question points. The creator sets it in Assessments → Create Exam or the existing assessment configuration editor. Existing owner permissions continue to apply; teachers manage their own assessments, and administrators retain their existing access.

Example: Quiz 1 10%, Quiz 2 10%, Midterm 25%, Final Test 35%, Assignment 20% = 100%. The eventual weighted contribution is `(assessment score / assessment maximum score) × courseWeight`. Course grade calculations now apply these individual weights. See `course-assessment-integration-v1.md` for finalization, completion and certificate rules.

Weights accept 0–100 with two decimal places. Blank means unconfigured; 0 means practice/no contribution. Clearing a previously configured field removes its weight. Legacy assessments stay unconfigured. No guessed weights or category-level percentages are added.

Choose a course in the assessment form to see the saved allocation, remaining percentage, and number of assessments without weights. Allocation includes all linked assessments, including inactive ones, to keep the course plan stable. A plan may total less than 100% while being built; a complete plan should total 100%. Normal saves and curriculum-link actions reject totals above 100%. Course locking serializes concurrent allocations. Standalone assessments can have a weight prepared in advance; the limit is checked when linked to a course.

## Lesson types

Quiz, Exam and Assignment are available alongside Video, Audio, Text, Document and Link in the lesson form. Enter assessment instructions instead of a resource URL. Instructions appear in the lesson preview and learning screen. Existing publishing validation requires instructions before publication.

When adding a new Quiz, Exam or Assignment lesson, the dialog now reuses the existing Assessment Management creation fields, including weight, title, duration in minutes, question format, attempts and rules. Enter lesson instructions and order, then click **Create assessment lesson**. The server creates both records in one transaction and automatically links the assessment to the actual course, section and new lesson. Failed assessment creation rolls back the lesson. Creation requires both `LESSON_CREATE` and `EXAM_CREATE`. Quiz and Assignment categories are fixed by lesson type; Exam allows Midterm or Final Test. Add assessment questions afterward through the existing Assessments page, just as with the normal Create Exam form.

Existing assessment lessons can still have their instructions edited in the lesson editor; assessment configuration and questions are edited through Assessments. The standalone Assessments creation form and existing curriculum-link action remain available. Quiz/Assignment remain the existing exam categories; Exam lessons can host a Midterm or Final Test. Lesson type does not create an empty assessment or duplicate the assessment engine. Existing lesson-linked assessment display, access checks, attempts and scoring remain in use.

## API contract for the exam management team

- Exam create/update requests and responses include nullable decimal `courseWeight`.
- Omit `courseWeight` on update to preserve its value; send null to clear it; send 0 for practice.
- Course/section/lesson assessment listing responses (`CourseExamDTO`) also include `courseWeight`.
- Lesson `contentType` accepts `QUIZ`, `EXAM`, `ASSIGNMENT`; instructions use existing `textContent`.
- No category-weight fields or new external dependencies are introduced.

On the default local H2 database, startup widens the old lesson-type check constraint without deleting lesson rows. This compatibility step runs only with Hibernate `update`; fresh databases already include the new values.

Default Hibernate schema updates add the nullable `exam.course_weight` decimal column. If automatic schema updates are disabled, add `course_weight DECIMAL(5,2) NULL` to `exam` and allow the three new strings in any manually managed lesson content-type constraint. Back up the database before applying schema changes.

## Manual checks

1. Create two assessments linked to a test course with weights 40 and 60. Confirm both save and the saved allocation becomes 100%.
2. Try another linked assessment with weight 1. Confirm it is rejected. Try a negative weight, 100.01, and three decimal places; confirm rejection.
3. Edit the 40% assessment to 30%. Confirm its own old weight is excluded from the calculation. Clear the field, save and reload; confirm it is unconfigured.
4. Prepare a standalone 50% assessment, then try linking it to a course already allocated 60%. Confirm the link is rejected.
5. With a different teacher account, confirm the existing ownership restriction prevents editing someone else's assessment. Admin access remains as before.
6. Create Quiz, Exam and Assignment lessons with instructions. Save, reopen and preview each. Confirm the shared assessment form opens, create the lesson and assessment together, then confirm the assessment already has the correct course, section and lesson. Add questions in Assessments and verify learner access using the normal assessment flow.
7. Confirm existing Video/Text lessons and course completion and certificate eligibility still work.

Build checks: frontend `npm run build`; backend `mvn -B -DskipTests package`. Regression checks cover weight bounds, precision, self-exclusion, exact totals, unconfigured/practice weights, lesson publishing validation and existing exam link/controller behavior. No browser or computer control was used. For the complete integrated workflow, follow `course-assessment-integration-v1.md`.

Combined endpoint: `POST /api/lessons/with-assessment` accepts `{lesson: LessonDTO, assessment: ExamDTO}` and returns both saved records. It validates both create requests and matches the assessment category to the lesson type. Submitted assessment linkage is replaced by the server-derived course/section/new lesson.
