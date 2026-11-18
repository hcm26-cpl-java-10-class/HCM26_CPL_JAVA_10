# Student Analytics

The Analytics menu contains Student Analytics at `/analytics/students`. The API is
`GET /api/analytics/students?from=YYYY-MM-DD&to=YYYY-MM-DD&interval=DAY|WEEK|MONTH&courseId=...`.
Dates are inclusive and the maximum range is 731 days. Activity timestamps are
grouped in `Asia/Ho_Chi_Minh`; weekly buckets start Monday and boundary buckets
include only dates within the selected range.

`STUDENT_ANALYTICS_READ` is granted to ADMIN and TEACHER. Admin sees all active
courses and active users with an active STUDENT role. Teacher sees courses where
`instructorUser.id` equals their user ID and the students enrolled in those courses.
A course outside this scope returns 403. With a selected course, all metrics use
that course's active enrollments; otherwise an admin's student count also includes
students with no active enrollments.

- New students: current active STUDENT accounts grouped by account creation date.
  Existing `User.createdAt` values are local timestamps interpreted in the server's
  current time zone, then converted to Vietnam time. Historical rows created under
  a different server time zone cannot be converted reliably without migration.
- Activity: distinct students with a recorded lesson access, completion update or
  saved answer. An event is saved transactionally with each successful interaction.
  Only interactions recorded after deployment are available; old events cannot be
  reconstructed from `lastAccessedAt`.
- Top students: average of the available published course scores on a 10-point
  scale. The calculation reuses the My Scores category weights and best submitted
  attempt. Unpublished/missing course scores are excluded. Equal rounded scores
  share a competition rank (1, 1, 3); ties at position 10 are ordered by user ID.
- Lowest progress: up to ten active student-course enrollments ordered by the
  percentage of active lessons in active sections completed. Courses without
  active lessons are excluded, not reported as zero progress.
- Enrollment distribution: active enrollments within the selected scope, bucketed
  as 0, 1, 2, 3, 4+.
- Completed without submitted exam: completed student-course pairs that have at
  least one active linked exam and no submitted attempt for any active linked exam,
  divided by completed pairs with at least one active linked exam. Empty
  denominators return `percentage: null`.

The date filter applies only to account creation and activity. Rankings, progress,
enrollment and completion-without-exam describe the current state. Progress uses
active lessons and sections, so it may differ from older screens that include
inactive content.
