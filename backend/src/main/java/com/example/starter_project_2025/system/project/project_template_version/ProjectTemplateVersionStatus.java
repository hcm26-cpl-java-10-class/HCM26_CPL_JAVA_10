package com.example.starter_project_2025.system.project.project_template_version;

/**
 * Lifecycle status of a project template version.
 * <p>
 * Business rule (US-07): every version created through "Create new version" is
 * stored as {@link #DRAFT} so it can be edited without touching the versions
 * already snapshotted into workspaces/projects. A version becomes
 * {@link #PUBLISHED} once it is in use and {@link #ARCHIVED} when it must be
 * kept for traceability only.
 */
public enum ProjectTemplateVersionStatus {

    DRAFT,
    PUBLISHED,
    ARCHIVED
}
