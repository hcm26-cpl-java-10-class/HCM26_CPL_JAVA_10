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
    oneTimeToken?: string | null;
    maxAccessTime?: string | null;
    maxAccessAttempts?: number;
    accessAttemptCount?: number;
}

export interface StudentInvitationDTO extends InvitationDTO {
    examTitle: string;
    durationMinutes?: number;
    startTime?: string | null;
    endTime?: string | null;
    maxAttempts?: number;
    totalPoints?: number;
    hasPassword?: boolean;
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
    studentName: string;
    studentEmail: string;
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
    fingerprint?: string;
}

export interface AnonymousSessionResponse {
    valid: boolean;
    sessionToken?: string;
    examTitle?: string;
    durationMinutes?: number;
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

export interface InvitationFilter {
    ids?: number[];
    isActive?: boolean;
    examId?: number;
    userId?: number;
    status?: InvitationStatus;
    userEmail?: string;
    examTitle?: string;
}

export interface RevokeInvitationRequest {
    reason?: string;
}