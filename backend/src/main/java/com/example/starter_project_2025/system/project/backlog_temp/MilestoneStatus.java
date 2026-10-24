package com.example.starter_project_2025.system.project.backlog_temp;

/**
 * Status of a milestone reference (temporary stand-in for the milestone module
 * owned by the project team).
 * <p>
 * A cancelled milestone can no longer be linked to a backlog item, which is the
 * scenario described by UFR-PRJ-003-02 / AC03.
 */
public enum MilestoneStatus {

    PLANNED,
    ACTIVE,
    COMPLETED,
    CANCELLED;

    public boolean isLinkable() {
        return this != CANCELLED;
    }
}
