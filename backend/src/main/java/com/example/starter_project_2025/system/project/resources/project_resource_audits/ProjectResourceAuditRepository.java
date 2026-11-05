package com.example.starter_project_2025.system.project.resources.project_resource_audits;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectResourceAuditRepository extends JpaRepository<ProjectResourceAuditLog, Long> {

    List<ProjectResourceAuditLog> findByProjectIdOrderByCreatedAtDesc(Long projectId);

    List<ProjectResourceAuditLog> findByResourceIdOrderByCreatedAtDesc(Long resourceId);
}
