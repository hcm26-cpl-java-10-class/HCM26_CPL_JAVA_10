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
    resultStatus: "PASSED" | "FAILED" | null;
    gradeItems: CourseGradeItemDTO[];
}