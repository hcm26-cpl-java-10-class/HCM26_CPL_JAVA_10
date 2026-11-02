package com.example.starter_project_2025.system.project.resources.template_resources;

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
public class TemplateResourceDTO extends BaseDTO {

    /** Owning template; immutable once the resource exists. */
    Long templateId;

    /** Derived from the template, read-only for clients. */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Long tenantId;

    String title;

    String description;

    ResourceKind kind;

    String url;

    String category;

    Integer orderIndex;
}
