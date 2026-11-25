package com.example.starter_project_2025.system.project.template.repository;

import com.example.starter_project_2025.system.project.template.domain.ProjectTemplateAudit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectTemplateAuditRepository extends JpaRepository<ProjectTemplateAudit, Long> {
    boolean existsByTenantIdAndActionAndCorrelationId(Long tenantId, String action, String correlationId);
}
