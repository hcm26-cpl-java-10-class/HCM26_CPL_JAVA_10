package com.example.starter_project_2025.system.project.milestone.submission.domain;

/** Why a reviewer cannot request changes (and a team cannot create the next version) for a submission. */
public enum ResubmissionBlockReason {
    MILESTONE_INACTIVE,
    MILESTONE_NOT_OPEN,
    MILESTONE_NOT_UNDER_REVIEW,
    RESUBMISSION_DISABLED,
    ATTEMPT_LIMIT_REACHED,
    PROJECT_NOT_ACTIVE;

    public String message(int attempts, Integer maxAttempts) {
        return switch (this) {
            case MILESTONE_INACTIVE -> "The milestone has been deactivated";
            case MILESTONE_NOT_OPEN -> "The milestone is not open (unpublished, closed or cancelled)";
            case MILESTONE_NOT_UNDER_REVIEW -> "The milestone is not waiting for review";
            case RESUBMISSION_DISABLED -> "Resubmission is disabled for this milestone";
            case ATTEMPT_LIMIT_REACHED -> "The submission attempt limit has been reached (" + attempts + "/" + maxAttempts + ")";
            case PROJECT_NOT_ACTIVE -> "The project is not active";
        };
    }
}
