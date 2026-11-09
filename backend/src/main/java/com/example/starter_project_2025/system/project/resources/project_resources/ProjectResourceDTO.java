package com.example.starter_project_2025.system.project.resources.project_resources;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.system.project.resources.ResourceKind;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectResourceDTO extends BaseDTO {

    /** Owning project; immutable once the resource exists. */
    Long projectId;

    /** Derived from the project, read-only for clients. */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Long tenantId;

    String title;

    String description;

    ResourceKind kind;

    String url;

    String category;

    Integer orderIndex;

    /** Provenance only, read-only for clients. */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Long sourceTemplateSnapshotId;

    /** Provenance only, read-only for clients. */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Long sourceTemplateResourceId;
}
