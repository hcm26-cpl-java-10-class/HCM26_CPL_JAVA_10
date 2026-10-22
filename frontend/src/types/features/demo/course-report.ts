export interface CourseReportItem {
    courseId: number;
    courseName: string;
    instructor?: string | null;
    courseStatus?: string | null;
    studentCount?: number | null;
    students?: string[] | null;
}