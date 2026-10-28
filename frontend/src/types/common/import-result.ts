export interface ImportError {

  rowNumber: number;

  message: string;
}

export interface GeneratedCredential {
  rowNumber: number;
  email: string;
  temporaryPassword: string;
}

export interface ImportResult {

  /** Tổng số dòng dữ liệu đọc được trong file import */
  totalCount?: number;

  successCount: number;

  failureCount: number;

  /** Existing records changed by the import (users: their password was updated). */
  updatedCount?: number;

  /** Rows skipped because nothing needed to change (users: existing account, no password given). */
  skippedCount?: number;

  /** Notification emails sent (account created, set-password link, password changed). */
  emailsSent?: number;

  /** Emails that could not be sent. The accounts were still created or updated. */
  emailsFailed?: number;

  /** Emails not sent because the per-import email limit was reached. */
  emailsSkipped?: number;

  /** Temporary passwords generated for rows without a password. Shown once; hand them out securely. */
  credentials?: GeneratedCredential[];

  errors: ImportError[];
}
