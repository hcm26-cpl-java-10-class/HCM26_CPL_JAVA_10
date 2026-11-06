import type { BaseDTO } from "@/types/common/base";

export type InvitationStatus =
    | "PENDING"
    | "SENT"
    | "ACCEPTED"
    | "REJECTED"
    | "EXPIRED"
    | "REVOKED"
    | "COMPLETED";

export interface InvitationDTO extends BaseDTO {
    id?: number;
    examId: number;
    userId?: number | null;
    examTitle?: string;
    userEmail?: string;
    userFullName?: string;
    userCode?: string | null;
    token?: string;
    status?: InvitationStatus;
    sentAt?: string | null;
    acceptedAt?: string | null;
    rejectedAt?: string | null;
    availableFrom?: string | null;
    expiresAt?: string | null;
    revokedAt?: string | null;
    revokedReason?: string | null;
    resendCount?: number;
    note?: string | null;
    anonymous?: boolean;
    guestName?: string | null;
    guestEmail?: string | null;
    accessCode?: string | null;
    maxAccessTime?: string | null;
    maxAccessAttempts?: number;

    examStartTime?: string | null;
    examEndTime?: string | null;
    examDurationMinutes?: number;
    examMaxAttempts?: number;
    examHasPassword?: boolean;
    /** Nguồn tạo lời mời: MANUAL hoặc COURSE. */
    sourceType?: string | null;
    /** Lớp (course) dùng làm nguồn khi tạo lời mời hàng loạt. */
    sourceCourseId?: number | null;
}

export interface InvitationCreateRequest {
    userId: number;
    note?: string;

    availableFrom?: string;
    expiresAt?: string;
}

export interface BatchInvitationItemResult {
    userId?: number;
    userEmail?: string;
    invitationId?: number;
    status: "SUCCESS" | "SKIPPED" | "FAILED" | string;
    reason?: string;
}

export interface BatchInvitationRequest {
    examId?: number;
    userIds?: number[];
    invitations?: InvitationCreateRequest[];
    sendEmail?: boolean;
    note?: string;
    expiresAt?: string;
}

export type InvitationBulkStatus = "SUCCESS" | "SKIPPED" | "FAILED";

/** Kết quả xử lý lời mời của một học viên trong bulk invite theo lớp. */
export interface InvitationBulkItemResult {
    userId?: number | null;
    userEmail?: string | null;
    userFullName?: string | null;
    invitationId?: number | null;
    status: InvitationBulkStatus;
    reason?: string | null;
}

/** Học viên thuộc một lớp (course) — nguồn danh sách để mời dự thi hàng loạt. */
export interface CourseStudentDTO {
    id: number;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
}

/** Yêu cầu mời dự thi hàng loạt theo lớp. `userIds` rỗng = mời toàn bộ lớp. */
export interface GroupInvitationRequest {
    courseId: number;
    userIds?: number[];
    note?: string;
    availableFrom?: string;
    expiresAt?: string;
    sendEmail?: boolean;
}

export interface BatchInvitationResponse {
    examId?: number;
    totalRequested: number;
    successCount: number;
    skippedCount?: number;
    failedCount?: number;
    failureCount?: number;
    items?: InvitationBulkItemResult[];
    successfulInvitations?: InvitationDTO[];
    errors?: string[];
}

export interface AnonymousInvitationRequest {

    studentName?: string;

    studentEmail?: string;
    note?: string;

    availableFrom?: string;
    expiresAt?: string;

    maxAccessTime?: string;
    maxAccessAttempts?: number;
}

export interface AnonymousAccessResponse {
    valid: boolean;
    accessCode?: string;
    examTitle?: string;
    studentName?: string;
    accessAttemptsRemaining?: number;
    message?: string;
    /** Backend có thể không trả về (endpoint public chỉ trả kết quả hợp lệ/không). */
    studentName?: string | null;
}

export interface AnonymousSessionRequest {
    accessCode: string;

    studentName: string;

    studentEmail: string;
    fingerprint?: string;
}

export interface AnonymousSessionResponse {
    valid: boolean;
    sessionToken?: string;
    examId?: number;
    examTitle?: string;
    durationMinutes?: number;
    studentName?: string;
    studentEmail?: string;
    message?: string;
}

export type ReminderType = "ONE_HOUR" | "ONE_DAY" | "CUSTOM";

export type ReminderStatus = "PENDING" | "SENT" | "FAILED" | "CANCELLED";

export interface ReminderDTO extends BaseDTO {
    id?: number;
    examId: number;
    invitationId?: number | null;
    examTitle?: string;
    userEmail?: string | null;
    userFullName?: string | null;
    reminderType: ReminderType;
    scheduledAt: string;
    sentAt?: string | null;
    status?: ReminderStatus;
    sendAttempts?: number;
    lastError?: string | null;
}

export interface ReminderRequest {
    reminderType: ReminderType;

    scheduledAt?: string;

    invitationId?: number;
}