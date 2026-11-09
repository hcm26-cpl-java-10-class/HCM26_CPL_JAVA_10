package com.example.starter_project_2025.system.audit;

import java.util.List;

/**
 * Values currently present in the audit log, used to fill the filter drop-downs.
 */
public record AuditLogFilterOptions(
        List<String> actions,
        List<String> entityTypes
) {
}
