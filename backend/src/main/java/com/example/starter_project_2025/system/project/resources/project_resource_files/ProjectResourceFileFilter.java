package com.example.starter_project_2025.system.project.resources.project_resource_files;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProjectResourceFileFilter extends BaseFilter {

    @FilterField(entityField = "resourceId", operator = FilterOperator.EQUAL)
    Long resourceId;

    @FilterField(entityField = "originalName", operator = FilterOperator.LIKE)
    String originalName;

    @FilterField(entityField = "contentType", operator = FilterOperator.EQUAL)
    String contentType;
}
