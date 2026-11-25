import type { NotificationCategory } from "./notification";

export type EmailDeliveryStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "SKIPPED_BY_PREFERENCE";

export interface EmailTemplateDTO {
  id: number;
  tenantId: number;
  code: string;
  name: string;
  category: NotificationCategory;
  description?: string | null;
  active: boolean;
  currentVersion: number;
  subjectTemplate: string;
  bodyHtml: string;
  sampleVariablesJson?: string | null;
  systemSeeded: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailTemplateVersionDTO {
  id: number;
  templateId: number;
  version: number;
  subjectTemplate: string;
  bodyHtml: string;
  changeNote?: string | null;
  createdByUserId?: number | null;
  createdAt: string;
}

export interface EmailTemplateUpsertRequest {
  code: string;
  name: string;
  category: NotificationCategory;
  description?: string;
  subjectTemplate: string;
  bodyHtml: string;
  sampleVariablesJson?: string;
  changeNote?: string;
}

export interface EmailTemplatePreviewResponse {
  renderedSubject: string;
  renderedBodyHtml: string;
}

export interface EmailAttemptDTO {
  id: number;
  tenantId?: number | null;
  idempotencyKey: string;
  batchId?: string | null;
  recipientUserId?: number | null;
  recipientEmail: string;
  category: NotificationCategory;
  templateCode?: string | null;
  templateVersion?: number | null;
  contextRef?: string | null;
  subject: string;
  renderedBodyHtml?: string | null;
  deliveryStatus: EmailDeliveryStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string | null;
  sentAt?: string | null;
  lastError?: string | null;
  correlationId?: string | null;
  createdByUserId?: number | null;
  createdAt: string;
}

export interface EmailSendRequest {
  templateId?: number;
  subject?: string;
  bodyHtml?: string;
  category?: NotificationCategory;
  contextRef?: string;
  classId?: number;
  recipientUserIds?: number[];
  recipientEmails?: string[];
  variables?: Record<string, string>;
  idempotencyKey?: string;
  respectPreference?: boolean;
}

export interface EmailBatchItemResult {
  recipientEmail: string;
  recipientUserId?: number | null;
  attemptId?: number | null;
  status: string;
  reason?: string | null;
}

export interface EmailBatchResult {
  batchId: string;
  idempotencyKey: string;
  duplicateRequest: boolean;
  total: number;
  queuedCount: number;
  skippedCount: number;
  failedCount: number;
  items: EmailBatchItemResult[];
}
