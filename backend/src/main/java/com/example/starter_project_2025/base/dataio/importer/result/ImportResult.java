package com.example.starter_project_2025.base.dataio.importer.result;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.List;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ImportResult {

    int successCount;
    int failureCount;

    /** Existing records that were changed by the import (for users: their password was updated). */
    int updatedCount;

    /** Rows skipped because nothing needed to change (for users: existing account, no password given). */
    int skippedCount;

    /** Notification emails sent for newly created records. */
    int emailsSent;

    /** Notification emails that could not be sent (the records were still created). */
    int emailsFailed;

    /** Notification emails not sent because the per-import email limit was reached. */
    int emailsSkipped;

    /** Temporary passwords generated for rows that had none. Shown once to the person who imported. */
    List<GeneratedCredential> credentials = new ArrayList<>();

    /** True when the import found errors and therefore saved nothing at all. */
    boolean rolledBack;

    /**
     * Codes of related records (for users: departments) that the file refers to but that do not exist yet.
     * Filled when the import was rolled back, so the screen can offer to add them.
     */
    List<String> missingCodes = new ArrayList<>();

    /** Short explanation for the person who ran the import (set when the import was rolled back). */
    String message;

    List<RowError> errors = new ArrayList<>();
}