package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.system.project.TeamAllocationSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Optional;
import java.util.List;

public interface ProjectAssignmentRepository extends JpaRepository<ProjectAssignment, Long> {
    Optional<ProjectAssignment> findByTenantIdAndClassIdAndIdempotencyKey(Long tenantId, Long classId, String key);
    List<ProjectAssignment> findAllBySessionIdAndMasterProjectIdIsNullAndIsActiveTrueOrderByIdAsc(Long sessionId);
    List<ProjectAssignment> findAllByTenantIdAndClassIdAndSessionIdAndModeAndIsActiveTrueOrderByAssignedAtDesc(
            Long tenantId, Long classId, Long sessionId, AssignmentDtos.Mode mode);

    @Query("""
            select a from ProjectAssignment a
            where a.tenantId = :tenantId and a.classId = :classId and a.isActive = true
              and a.sourceVersionId in (select v.id from ProjectTemplateSnapshot v where v.templateId = :templateId)
              and a.sessionId in (select s.id from TeamAllocationSession s where s.status <> :cancelled)
            """)
    List<ProjectAssignment> findActiveForMaster(Long tenantId, Long classId, Long templateId,
                                                TeamAllocationSessionStatus cancelled);
}
