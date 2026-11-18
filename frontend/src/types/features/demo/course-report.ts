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
    /** Ảnh bìa khóa học. */
    thumbnailUrl?: string | null;
    /** Số bài học active. */
    lessonCount?: number | null;
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

// ===== Learning hours analytics =====

/** Một dòng của bảng Learning hours analytics (mỗi dòng = một lượt đăng ký). */
export interface LearningHoursRow {
    enrollmentId: number;
    userId: number;
    studentName?: string | null;
    studentEmail?: string | null;
    departmentName?: string | null;
    courseId: number;
    courseName: string;
    /** Ngày đăng ký - dùng để đối chiếu với thời gian học. */
    enrolledAt?: string | null;
    lastAccessedAt?: string | null;
    completedLessons: number;
    totalLessons: number;
    completionRate: number;
    /** Giờ học của riêng khóa học này. */
    enrollmentHours: number;
    /** Tổng giờ học của học viên trên tất cả khóa đã đăng ký. */
    studentHours: number;
    /** Tổng giờ học của phòng ban. */
    departmentHours: number;
    /** Tổng giờ học của khóa học. */
    courseHours: number;
    daysSinceEnrollment: number;
}

/** Một nhóm tổng hợp giờ học (phòng ban / khóa học / học viên). */
export interface LearningHoursGroup {
    id?: number | null;
    name: string;
    code?: string | null;
    totalHours: number;
    /** Số học viên DUY NHẤT trong nhóm (không phải số lượt đăng ký). */
    learnerCount: number;
    /** Số lượt đăng ký trong nhóm. */
    enrollmentCount: number;
    averageHours: number;
    /** Số khóa học mà học viên đã đăng ký (chỉ có ở nhóm học viên). */
    courseCount?: number | null;
}

export interface LearningHoursTotals {
    totalHours: number;
    totalEnrollments: number;
    studentCount: number;
    courseCount: number;
    departmentCount: number;
    averageHoursPerStudent: number;
    averageHoursPerCourse: number;
}

export interface LearningHoursReport {
    rows: LearningHoursRow[];
    totals: LearningHoursTotals;
    departments: LearningHoursGroup[];
    courses: LearningHoursGroup[];
    students: LearningHoursGroup[];
}
