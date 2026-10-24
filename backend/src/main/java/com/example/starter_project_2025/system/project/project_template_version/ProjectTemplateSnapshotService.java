package com.example.starter_project_2025.system.project.project_template_version;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.project.project_template_version.audit.ProjectTemplateSnapshotAuditLogDTO;

import java.util.List;

public interface ProjectTemplateSnapshotService
        extends BaseCrudService<Long, ProjectTemplateSnapshotDTO, ProjectTemplateSnapshotFilter> {

    /**
     * Creates a new version from an existing one (US-07 / AC01).
     * <p>
     * The new row gets the next automatic version label ({@code v1.0 -> v2.0}),
     * copies the source version configuration, is stored as
     * {@link ProjectTemplateVersionStatus#DRAFT} and keeps
     * {@code parentTemplateId} pointing at the source version. The source row is
     * never modified, so already snapshotted workspaces stay untouched.
     */
    ProjectTemplateSnapshotDTO createNewVersion(Long sourceVersionId);

    /**
     * All versions of a project template, newest first.
     */
    List<ProjectTemplateSnapshotDTO> getByTemplate(Long templateId);

    /**
     * Audit trail of a snapshot, newest first.
     */
    List<ProjectTemplateSnapshotAuditLogDTO> getAuditLogs(Long snapshotId);

    /**
     * Flattened rows for the Excel/CSV export.
     */
    List<ProjectTemplateSnapshotExportRow> getExportRows();
}
