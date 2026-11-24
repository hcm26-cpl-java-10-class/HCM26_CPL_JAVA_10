package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.BacklogLinkSource;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;

import java.time.LocalDateTime;

/**
 * TM-03: why a pull request is on a task. AUTO: {@code field} says where the Task ID was
 * found (TITLE / BODY). MANUAL: linked or pinned by {@code linkedByName}; {@code field} is null.
 */
public record BacklogGitLinkInfo(
        Long id,
        BacklogLinkSource source,
        BacklogReferenceField field,
        Long linkedByUserId,
        String linkedByName,
        LocalDateTime linkedAt) {
}
