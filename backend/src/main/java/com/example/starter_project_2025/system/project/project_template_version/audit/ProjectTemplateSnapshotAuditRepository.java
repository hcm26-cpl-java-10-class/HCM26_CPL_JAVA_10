package com.example.starter_project_2025.system.project.project_template_version.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectTemplateSnapshotAuditRepository
        extends JpaRepository<ProjectTemplateSnapshotAuditLog, Long> {

    List<ProjectTemplateSnapshotAuditLog> findBySnapshotIdOrderByCreatedAtDesc(Long snapshotId);
}
