import type { BaseDTO } from "@/types/common/base";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "REVOKED" | "EXPIRED";

export interface InvitationDTO extends BaseDTO {
  examId: number;
  userId: number;
  examTitle?: string;
  userEmail?: string;
  userFullName?: string;
  status?: InvitationStatus;
  sentAt?: string;
  resendCount?: number;
  revokedAt?: string;
  revokedReason?: string;
  expiresAt?: string;
  note?: string;
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

export interface InvitationFilter {
  ids?: number[];
  isActive?: boolean;
  examId?: number;
  userId?: number;
  status?: InvitationStatus;
  userEmail?: string;
  examTitle?: string;
}

export interface BatchInvitationRequest {
  examId: number;
  userIds: number[];
  note?: string;
  expiresAt?: string;
}

export interface BatchInvitationItemResult {
  userId?: number;
  userEmail?: string;
  invitationId?: number;
  status: "SUCCESS" | "SKIPPED" | "FAILED" | string;
  reason?: string;
}

export interface BatchInvitationResponse {
  examId: number;
  totalRequested: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  items: BatchInvitationItemResult[];
}

export interface RevokeInvitationRequest {
  reason?: string;
}
