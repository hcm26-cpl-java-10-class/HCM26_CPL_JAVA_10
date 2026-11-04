import type { DepartmentMember } from "./department";

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

export interface DepartmentBatchItemResult {
    departmentId: number;
    departmentName: string;
    studentCount: number;
    alreadyEnrolled: number;
    newEnrollments: number;
    excludedCount: number;
    /** Preview: sáº½ Ä‘Æ°á»£c enroll. Result: Ä‘Ã£ Ä‘Æ°á»£c enroll tháº­t. */
    newMembers: DepartmentMember[];
    /** ÄÃ£ enroll tá»« trÆ°á»›c (hoáº·c qua department khÃ¡c trong cÃ¹ng láº§n assign). */
    alreadyEnrolledMembers: DepartmentMember[];
    /** Bá»‹ bá» tick nÃªn khÃ´ng Ä‘Æ°á»£c enroll. */
    excludedMembers: DepartmentMember[];
}

export interface DepartmentBatchEnrollmentResult {
    courseId: number;
    courseName: string;
    totalNewEnrollments: number;
    totalAlreadyEnrolled: number;
    departments: DepartmentBatchItemResult[];
}

export interface AuditLogRow {
    id: string;
    type: "ENROLLMENT" | "DEPARTMENT";
    actorName?: string;
    actorEmail?: string;
    targetName?: string;
    targetType?: string;
    courseName?: string;
    departmentName?: string;
    detail?: string;
    status?: string;
    source?: string;
    progressPercentage?: number;
    cancellationReason?: string;
    createdAt?: string;
}

export interface AuditLogParams {
    type?: string;
    search?: string;
    status?: string;
    source?: string;
    fromDate?: string;
    toDate?: string;
    page: number;
    size: number;
}
