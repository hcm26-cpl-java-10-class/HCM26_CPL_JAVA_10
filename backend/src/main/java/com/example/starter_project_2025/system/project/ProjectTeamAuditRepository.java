package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectTeamAuditRepository
        extends BaseCrudRepository<ProjectTeamAudit, Long> {
}
