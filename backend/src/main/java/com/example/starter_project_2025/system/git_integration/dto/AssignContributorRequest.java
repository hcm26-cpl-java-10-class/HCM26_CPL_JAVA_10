package com.example.starter_project_2025.system.git_integration.dto;

import jakarta.validation.constraints.NotNull;

/** GI-06 AC11: the member an e-mail-only contributor is assigned to. */
public record AssignContributorRequest(@NotNull Long userId) {
}
