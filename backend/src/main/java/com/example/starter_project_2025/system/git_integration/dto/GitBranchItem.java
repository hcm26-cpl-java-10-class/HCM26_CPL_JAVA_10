package com.example.starter_project_2025.system.git_integration.dto;

import java.time.LocalDateTime;

/**
 * WS-GH-02: a branch (without refs/heads/) with the commits first pushed to it and its latest commit.
 * SY-07: also the branches known from GitHub without such commits (fully merged, or nothing new),
 * with how far they are ahead of / behind the default branch at the last sync, and whether they
 * were deleted on GitHub or only partly imported ({@code truncated}).
 */
public record GitBranchItem(String name, long commits, LocalDateTime lastCommitAt,
                            Integer aheadBy, Integer behindBy, boolean deleted, boolean truncated, boolean isDefault) {

    public GitBranchItem(String name, long commits, LocalDateTime lastCommitAt) {
        this(name, commits, lastCommitAt, null, null, false, false, false);
    }
}
