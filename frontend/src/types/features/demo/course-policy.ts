export interface CompletionRule {
  /** Share of active lessons a learner must finish (1..100). */
  minLessonPercent: number;
  /** true = learner must also pass the graded assessments. */
  requireAssessmentsPass: boolean;
  /** false = no custom rule saved, the default (100% + pass) applies. */
  customized: boolean;
}

export interface CoursePrerequisite {
  courseId: number;
  courseName: string;
  /** true = the current user already completed this course. */
  met: boolean;
}
