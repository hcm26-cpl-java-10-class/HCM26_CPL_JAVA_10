package com.example.starter_project_2025.system.resource_assignment.dto;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.system.resource_assignment.domain.ResourceType;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class ClassResourceAssignmentFilter extends BaseFilter {

    @FilterField
    Long classId;

    @FilterField
    ResourceType resourceType;

    @FilterField
    Long resourceId;
}