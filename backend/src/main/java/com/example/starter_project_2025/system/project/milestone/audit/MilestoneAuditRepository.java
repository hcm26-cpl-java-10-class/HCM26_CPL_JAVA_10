package com.example.starter_project_2025.system.project.milestone.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MilestoneAuditRepository extends JpaRepository<MilestoneAuditLog, UUID> {
    long countByMilestoneId(UUID milestoneId);
    long countByMilestoneIdAndAction(UUID milestoneId, String action);
    java.util.List<MilestoneAuditLog> findAllByMilestoneIdAndActionOrderByCreatedAtAsc(
            UUID milestoneId, String action);
}
