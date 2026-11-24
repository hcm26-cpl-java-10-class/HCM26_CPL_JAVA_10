package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;

import java.util.EnumSet;
import java.util.Set;

/** SY-05: filter of the commit / pull request lists by task link verdict. */
public enum TaskLinkFilter {
    /** At least one Task ID linked. */
    LINKED(EnumSet.of(BacklogReferenceStatus.LINKED)),
    /** Something to look at: no Task ID, an unknown one, or one of another project. */
    NEEDS_ATTENTION(EnumSet.of(BacklogReferenceStatus.MISSING, BacklogReferenceStatus.INVALID, BacklogReferenceStatus.OUTSIDE_PROJECT)),
    MISSING(EnumSet.of(BacklogReferenceStatus.MISSING)),
    INVALID(EnumSet.of(BacklogReferenceStatus.INVALID)),
    OUTSIDE_PROJECT(EnumSet.of(BacklogReferenceStatus.OUTSIDE_PROJECT));

    private final Set<BacklogReferenceStatus> statuses;

    TaskLinkFilter(Set<BacklogReferenceStatus> statuses) {
        this.statuses = statuses;
    }

    public Set<BacklogReferenceStatus> statuses() {
        return statuses;
    }
}
