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

    /** Rows skipped because the record already exists. */
    int skippedCount;

    /** Notification emails sent for newly created records. */
    int emailsSent;

    /** Notification emails that could not be sent (the records were still created). */
    int emailsFailed;
    List<RowError> errors = new ArrayList<>();
}