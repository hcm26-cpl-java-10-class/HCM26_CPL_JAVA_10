package com.example.starter_project_2025.system.project.milestone.risk;
/** UFR-COM consumer contract. No worker or success/no-op adapter is installed.
 * Deliver both channels, deduplicate by event_id/user_id/channel and acknowledge only after success. */
public interface MilestoneRiskNotificationPort {
    void deliver(MilestoneRiskDtos.Event event);
}
