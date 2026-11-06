package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface ProjectAssignmentRepository extends JpaRepository<ProjectAssignment, Long> {
    Optional<ProjectAssignment> findByTenantIdAndClassIdAndIdempotencyKey(Long tenantId, Long classId, String key);
    List<ProjectAssignment> findAllByTenantIdAndClassIdAndSessionIdAndModeAndIsActiveTrueOrderByAssignedAtDesc(
            Long tenantId, Long classId, Long sessionId, AssignmentDtos.Mode mode);
}
