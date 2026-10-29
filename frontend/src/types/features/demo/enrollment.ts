export interface Enrollment {
    id: number;
    courseId: number;
    courseName: string;
    courseDescription?: string | null;
    instructor?: string | null;
    thumbnailUrl?: string | null;
    enrolledAt?: string | null;
}
