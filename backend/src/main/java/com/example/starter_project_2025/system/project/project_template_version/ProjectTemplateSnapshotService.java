package com.example.starter_project_2025.system.project.project_template_version;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.project_template_version.audit.ProjectTemplateSnapshotAuditLogDTO;

import java.util.List;

public interface ProjectTemplateSnapshotService
        extends BaseCrudService<Long, ProjectTemplateSnapshotDTO, ProjectTemplateSnapshotFilter> {

    /**
     * Creates a new version from an existing one (US-07 / AC01).
     * <p>
     * The new row gets the next automatic version label ({@code v1.0 -> v2.0}),
     * copies the source configuration into a new draft Project Template row,
     * and links its baseline snapshot to the source version. Existing project
     * snapshots stay untouched.
     */
    ProjectTemplateSnapshotDTO createNewVersion(Long sourceVersionId);

    /**
     * Duplicates an existing version into a brand new, fully independent
     * Project Template (US-08 / AC01).
     * <p>
     * The copy gets the client supplied {@code name}, the default version
     * {@code v1.0} and the status
     * {@link ProjectTemplateVersionStatus#DRAFT}. The whole configuration
     * (rules, milestones, rubric - i.e. {@code contentJson}) is copied from the
     * source version, while {@code parentTemplateId} stays {@code null} so the
     * copy keeps no version-tree link to the original template.
     * <p>
     * Branching from US-07: {@link #createNewVersion(Long)} keeps the family
     * and code, while this method starts a new family.
     */
    ProjectTemplateSnapshotDTO duplicateTemplate(Long sourceVersionId, String name);

    /**
     * US-07 / AC01: seeds the baseline {@code v1.0} / {@code DRAFT} snapshot of
     * a freshly created Project Template.
     * <p>
     * Called by the Project Template module right after the template row is
     * persisted, so every template has a version chain from the start (the
     * Program Manager can then derive {@code v2.0}, {@code v3.0}, ... without
     * having to POST a version by hand).
     * <p>
     * The call is idempotent - it returns {@code null} when the template already
     * owns at least one version - and bypasses the
     * {@code PROJECT_TEMPLATE_VERSION_CREATE} permission check because the caller
     * already authorised {@code PROJECT_TEMPLATE_CREATE}.
     */
    ProjectTemplateSnapshotDTO createInitialVersion(ProjectTemplate template);

    ProjectTemplateSnapshotDTO createInitialVersion(ProjectTemplate template, Long parentSnapshotId);

    /**
     * Same as {@link #createInitialVersion(ProjectTemplate)} but loads the
     * template first, so the version chain of a template created before the
     * linkage was wired can be initialised from the API.
     */
    ProjectTemplateSnapshotDTO createInitialVersion(Long templateId);

    /**
     * Publishes the newest active version of a template ({@code DRAFT} ->
     * {@code PUBLISHED}).
     * <p>
     * Called when the Project Template itself is activated: the DRAFT version
     * being published is refreshed with the configuration that is being
     * activated (overview, constraints, milestone plan) so a version can never
     * be published with a stale payload. Older versions are never touched,
     * which keeps the snapshot isolation of already created
     * workspaces/projects (US-07 / AC02).
     */
    ProjectTemplateSnapshotDTO publishLatestVersion(ProjectTemplate template);

    void archivePublishedVersion(ProjectTemplate template);

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
