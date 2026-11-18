package com.example.starter_project_2025.system.project.milestone.risk;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface MilestoneRiskAlertRepository extends JpaRepository<MilestoneRiskAlert, UUID> {
    Optional<MilestoneRiskAlert> findByActorIdAndRequestId(Long actorId, UUID requestId);
    List<MilestoneRiskAlert> findByMilestoneIdOrderByCreatedAtDesc(UUID milestoneId);
}
