export interface ImportError {

  rowNumber: number;

  message: string;
}

export interface ImportResult {

  successCount: number;

  failureCount: number;

  /** Rows skipped because the record already exists (no email is sent for them). */
  skippedCount?: number;

  /** Emails sent for newly created accounts (password email or set-password email). */
  emailsSent?: number;

  /** Emails that could not be sent. The accounts were still created. */
  emailsFailed?: number;

  errors: ImportError[];
}
