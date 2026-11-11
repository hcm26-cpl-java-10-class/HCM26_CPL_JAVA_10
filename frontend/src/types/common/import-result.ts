
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

  /** True when the import had errors and saved nothing. */
  rolledBack?: boolean;

  /** Codes the file refers to that do not exist yet (for users: departments). */
  missingCodes?: string[];

  /** Explanation shown to the person who ran the import when nothing was saved. */
  message?: string;

  errors: ImportError[];
}

/** Server-validated data shown before any rows are saved. */
export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  canImport: boolean;
  columns: string[];
  requiredColumns?: string[];
  warnings?: string[];
  rules?: string[];

  rows: {
    rowNumber: number;
    values: Record<string, string | null>;
    valid: boolean;
    errors: string[];
  }[];
}

export interface ImportInputRow {
  rowNumber: number;
  values: Record<string, string | null>;
}
