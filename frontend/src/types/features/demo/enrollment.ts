export interface Enrollment {
    id: number;
    courseId: number;
    courseName: string;
    instructor?: string | null;
    thumbnailUrl?: string | null;
    enrolledAt?: string | null;
}

export interface DepartmentEnrollmentPreview {
    departmentId: number;
    courseId: number;
    courseName: string;
    studentCount: number;
    alreadyEnrolled: number;
    newEnrollments: number;
}

export interface DepartmentEnrollmentResult extends DepartmentEnrollmentPreview {}