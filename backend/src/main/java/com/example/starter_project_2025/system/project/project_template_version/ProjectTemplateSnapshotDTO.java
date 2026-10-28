package com.example.starter_project_2025.system.project.project_template_version;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * Payload of the project template version (snapshot) use case.
 * <p>
 * {@code templateId} and {@code projectId} are stored as plain identifiers so
 * the importer/exporter and the CRUD filter keep working on the raw columns.
 * The owning Project Template is still validated on create and resolved on
 * read: {@code templateName} and {@code projectName} are filled by the service
 * from the {@code project_templates} / {@code project} rows, so clients never
 * have to render a raw id.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectTemplateSnapshotDTO extends BaseDTO {

    Long templateId;

    /**
     * Name of the owning Project Template. Read-only projection resolved by the
     * service (never stored on the snapshot row).
     */
    String templateName;

    Long projectId;

    /**
     * Name of the {@code Project} referenced by {@link #projectId}. Read-only
     * projection resolved by the service (never stored on the snapshot row).
     * Stays {@code null} while the version is not bound to a project.
     */
    String projectName;

    /** Id of the version this one was cloned from ({@code parent_template_id}). */
    Long parentTemplateId;

    String version;

    /** Lifecycle status; a newly created version defaults to {@code DRAFT}. */
    ProjectTemplateVersionStatus status;

    String contentJson;
}
