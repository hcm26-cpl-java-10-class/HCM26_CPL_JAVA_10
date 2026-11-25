package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.BacklogLinkSource;
import jakarta.validation.constraints.NotNull;

/** TM-03: {@code {"source": "MANUAL"}} pins an automatic link so editing the pull request no longer removes it. */
public record UpdateGitLinkRequest(@NotNull BacklogLinkSource source) {
}
