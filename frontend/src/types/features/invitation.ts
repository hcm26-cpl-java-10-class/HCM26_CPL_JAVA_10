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
    token?: string;
    status?: InvitationStatus;
    sentAt?: string | null;
    acceptedAt?: string | null;
    rejectedAt?: string | null;
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

    // Thông tin đề thi cho phía student (enriched từ server)
    examStartTime?: string | null;
    examEndTime?: string | null;
    examDurationMinutes?: number;
    examMaxAttempts?: number;
    examHasPassword?: boolean;
}

export interface InvitationCreateRequest {
    userId: number;
    note?: string;
    /** ISO-8601 datetime string */
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

export interface BatchInvitationResponse {
    examId?: number;
    totalRequested: number;
    successCount: number;
    skippedCount?: number;
    failedCount?: number;
    failureCount?: number;
    items?: BatchInvitationItemResult[];
    successfulInvitations?: InvitationDTO[];
    errors?: string[];
}

export interface AnonymousInvitationRequest {
    /** Tuỳ chọn — giáo viên có thể nhập trước, hoặc để học sinh tự khai khi mở link. */
    studentName?: string;
    /** Tuỳ chọn — nếu có email thì link được gửi qua email cho học sinh. */
    studentEmail?: string;
    note?: string;
    /** ISO-8601 datetime string */
    expiresAt?: string;
    /** ISO-8601 datetime string */
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
}

export interface AnonymousSessionRequest {
    accessCode: string;
    /** Họ tên - phải khớp với lời mời đã cấp. */
    studentName: string;
    /** Email - phải khớp với lời mời, dùng để gửi kết quả bài thi. */
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
    /** Required when reminderType is CUSTOM */
    scheduledAt?: string;
    /** Omit to target every active invitation of the exam */
    invitationId?: number;
}