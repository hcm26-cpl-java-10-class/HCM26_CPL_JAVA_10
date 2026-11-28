import type { QueryClient } from "@tanstack/react-query";

/** Assessment mutations affect both outlines and grading, including old course links. */
export function invalidateAssessmentViews(client: QueryClient) {
  return Promise.all([
    "course-exams", "course-detail", "course-assessment-plan", "course-assessment-allocation",
    "course-selected-curriculum", "section-courses", "section-lessons", "lessons",
    "exam-management", "available-exams-for-course", "exam-detail",
  ].map(key => client.invalidateQueries({ queryKey: [key] })));
}
