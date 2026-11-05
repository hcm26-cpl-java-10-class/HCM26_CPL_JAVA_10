package com.example.starter_project_2025.system.project.alert;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface ProjectAlertBatchRepository extends JpaRepository<ProjectAlertData.Batch,UUID> {
    Optional<ProjectAlertData.Batch> findByActorIdAndRequestId(Long actorId,UUID requestId);
    List<ProjectAlertData.Batch> findTop100ByTeamIdAndTenantIdAndKindOrderByCreatedAtDesc(Long teamId,Long tenantId,ProjectAlertDtos.Kind kind);
    org.springframework.data.domain.Page<ProjectAlertData.Batch> findByTeamIdAndTenantIdAndProjectIdAndKindIn(
            Long teamId, Long tenantId, Long projectId, Collection<ProjectAlertDtos.Kind> kinds,
            org.springframework.data.domain.Pageable pageable);
}
