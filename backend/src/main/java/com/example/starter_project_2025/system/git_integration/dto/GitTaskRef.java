package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceReason;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;

/**
 * SY-05: a Task ID found in a commit or a pull request and its verdict. {@code key} is
 * null for the MISSING entry (no Task ID at all). The task title and status are only
 * given for LINKED: a task of another project is never described.
 */
public record GitTaskRef(
        String key,
        String rawText,
        BacklogReferenceStatus status,
        BacklogReferenceReason reason,
        BacklogReferenceField field,
        Long itemId,
        String itemTitle,
        String itemStatus) {
}
