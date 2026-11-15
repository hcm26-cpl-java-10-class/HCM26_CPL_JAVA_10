export interface CourseGradeItemDTO {
    gradeCategory: "Assignment" | "Midterm" | "Final" | "Quiz";
    examId: number | null;
    gradeItem: string | null;
    gradeWeight: number | null;
    value: number | null;
}

export interface CourseMyScoresDTO {
    courseId: number;
    courseCode: string | null;
    courseName: string;
    className: string | null;
    thumbnailUrl: string | null;
    overallScore: number | null;
    resultStatus: "PASSED" | "FAILED" | "PLAN_INCOMPLETE" | "IN_PROGRESS" | "AWAITING_RESULTS" | "NO_ASSESSMENTS" | null;
    gradeItems: CourseGradeItemDTO[];
}
export const COURSE_GRADE_STATUS_LABEL: Record<string, string> = {
  PASSED: "Passed", FAILED: "Failed", PLAN_INCOMPLETE: "Assessment plan incomplete",
  IN_PROGRESS: "Assessments not yet completed or graded", AWAITING_RESULTS: "Waiting for published results",
  NO_ASSESSMENTS: "No graded assessments",
};
