package com.example.starter_project_2025.system.project.milestone.domain;

import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus;

/** Single business state. The old status columns are retained for existing API consumers. */
public enum MilestoneLifecycleStatus {
    PLANNED, IN_PROGRESS, SUBMITTED, CHANGES_REQUESTED, ACCEPTED, REJECTED;

    public static MilestoneLifecycleStatus of(MilestoneStatus status, MilestoneExecutionStatus execution) {
        return switch (status) {
            case PLANNED -> PLANNED;
            case CLOSED -> ACCEPTED;
            case CANCELLED -> REJECTED;
            case OPEN -> switch (execution == null ? MilestoneExecutionStatus.IN_PROGRESS : execution) {
                case TODO -> PLANNED;
                case IN_PROGRESS -> IN_PROGRESS;
                case REVIEW -> SUBMITTED;
                case DONE -> ACCEPTED;
                case FAILED -> REJECTED;
            };
        };
    }
}
