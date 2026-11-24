package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.BacklogLinkSource;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceReason;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;

/**
 * SY-05: a Task ID found in a commit or a pull request and its verdict. {@code key} is
 * null for the MISSING entry (no Task ID at all). The task title and status are only
 * given for LINKED: a task of another project is never described. TM-03: {@code source}
 * is how the pull request / commit is linked to the task (AUTO, MANUAL), null when it is not.
 * A MANUAL link without any Task ID in the text is listed with {@code field} NONE.
 * WS-GH-02: {@code itemProjectId} is the project of the linked task (a module's task when it
 * lives in a module), so the workspace can open the task in the right project.
 */
public record GitTaskRef(
        String key,
        String rawText,
        BacklogReferenceStatus status,
        BacklogReferenceReason reason,
        BacklogReferenceField field,
        Long itemId,
        String itemTitle,
        String itemStatus,
        BacklogLinkSource source,
        Long itemProjectId) {
}
