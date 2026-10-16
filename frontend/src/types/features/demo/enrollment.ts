export interface Enrollment {
    id: number;
    courseId: number;
    courseName: string;
    instructor?: string | null;
    thumbnailUrl?: string | null;
    enrolledAt?: string | null;
}