package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitContributorMapSource;

import java.time.LocalDateTime;

/** GI-06: a contributor of a master project after a mapping change. */
public record GitContributorView(Long contributorId, Kind kind, String login, String email, String displayName,
                                 Long userId, GitContributorMapSource source, LocalDateTime mappedAt) {

    public enum Kind { GITHUB, EMAIL }
}
