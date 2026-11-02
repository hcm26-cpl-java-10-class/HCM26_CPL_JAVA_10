package com.example.starter_project_2025.system.project.resources.project_resources;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import com.example.starter_project_2025.system.project.resources.ResourceKind;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProjectResourceFilter extends BaseFilter {

    @FilterField(entityField = "projectId", operator = FilterOperator.EQUAL)
    Long projectId;

    @FilterField(entityField = "tenantId", operator = FilterOperator.EQUAL)
    Long tenantId;

    @FilterField(entityField = "kind", operator = FilterOperator.EQUAL)
    ResourceKind kind;

    @FilterField(entityField = "category", operator = FilterOperator.EQUAL)
    String category;

    @FilterField(entityField = "title", operator = FilterOperator.LIKE)
    String title;
}
