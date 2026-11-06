package com.example.starter_project_2025.system.project.alert;
import java.util.*;
/** Replace this adapter when Curriculum/Milestone provides the canonical work-item relation. */
public interface AlertMilestoneProgressSource {
    /** Empty Optional means unknown linkage; a present empty set means explicitly no planned work. */
    Optional<Set<Long>> backlogItemIds(UUID milestoneId,Long teamId,Long tenantId);
}
