package com.example.starter_project_2025.system.project.project_template_version;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProjectTemplateSnapshotFilter extends BaseFilter {

    @FilterField(entityField = "templateId", operator = FilterOperator.EQUAL)
    Long templateId;

    @FilterField(entityField = "projectId", operator = FilterOperator.EQUAL)
    Long projectId;

    @FilterField(entityField = "parentTemplateId", operator = FilterOperator.EQUAL)
    Long parentTemplateId;

    @FilterField(entityField = "version", operator = FilterOperator.EQUAL)
    String version;

    @FilterField(entityField = "status", operator = FilterOperator.EQUAL)
    ProjectTemplateVersionStatus status;
}
