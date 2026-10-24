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
 * {@code templateId} and {@code projectId} are plain identifiers: the owning
 * modules are not implemented yet, so clients can send any id and the value is
 * stored without being validated against another table.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectTemplateSnapshotDTO extends BaseDTO {

    Long templateId;

    Long projectId;

    /** Id of the version this one was cloned from ({@code parent_template_id}). */
    Long parentTemplateId;

    String version;

    /** Lifecycle status; a newly created version defaults to {@code DRAFT}. */
    ProjectTemplateVersionStatus status;

    String contentJson;
}
