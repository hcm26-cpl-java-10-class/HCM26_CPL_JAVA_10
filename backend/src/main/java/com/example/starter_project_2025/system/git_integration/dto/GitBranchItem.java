package com.example.starter_project_2025.system.git_integration.dto;

import java.time.LocalDateTime;

/** WS-GH-02: a branch (without refs/heads/) commits were first pushed to, with its commit count and latest commit. */
public record GitBranchItem(String name, long commits, LocalDateTime lastCommitAt) {
}
