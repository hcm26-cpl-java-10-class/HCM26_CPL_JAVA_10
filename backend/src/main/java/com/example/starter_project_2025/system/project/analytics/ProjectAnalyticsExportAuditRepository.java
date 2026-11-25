package com.example.starter_project_2025.system.project.analytics;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** Repository for immutable US-ANL-010 analytics export audit entries. */
public interface ProjectAnalyticsExportAuditRepository
        extends JpaRepository<ProjectAnalyticsExportAuditLog, UUID> {
}
