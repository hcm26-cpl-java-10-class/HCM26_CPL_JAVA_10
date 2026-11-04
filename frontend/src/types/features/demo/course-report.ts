export interface CourseReportItem {
    courseId: number;
    courseName: string;
    instructor?: string | null;
    courseStatus?: string | null;
    studentCount?: number | null;
    students?: string[] | null;
    categories?: string[] | null;
    courseLevel?: string | null;
    averageProgress?: number;
    activeLearners?: number;
    completedLearners?: number;
    completionRate?: number;
    certificatesIssued?: number;
    learners?: CourseLearnerReport[];
}

export interface CourseLearnerReport {
    enrollmentId: number;
    studentName?: string | null;
    studentEmail?: string | null;
    progressPercentage: number;
    completed: boolean;
    enrolledAt?: string | null;
}
