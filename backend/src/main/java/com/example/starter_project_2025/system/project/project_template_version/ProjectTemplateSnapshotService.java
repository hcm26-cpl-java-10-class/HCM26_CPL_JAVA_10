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
     * Duplicates an existing version into a brand new, fully independent
     * Project Template (US-08 / AC01).
     * <p>
     * The copy gets the client supplied {@code code} and {@code name} (the code
     * must be unique), the default version {@code v1.0} and the status
     * {@link ProjectTemplateVersionStatus#DRAFT}. The whole configuration
     * (rules, milestones, rubric - i.e. {@code contentJson}) is copied from the
     * source version, while {@code parentTemplateId} stays {@code null} so the
     * copy keeps no version-tree link to the original template.
     * <p>
     * Branching from US-07: {@link #createNewVersion(Long)} derives a new
     * version <em>of the same template</em> and therefore keeps
     * {@code templateId} and links {@code parentTemplateId}; this method
     * creates a new template instead.
     */
    ProjectTemplateSnapshotDTO duplicateTemplate(Long sourceVersionId, String code, String name);

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
