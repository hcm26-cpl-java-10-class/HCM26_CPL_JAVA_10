package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class SprintFilter extends BaseFilter {

    @FilterField(entityField = "project.id", operator = FilterOperator.EQUAL)
    Long projectId;

    @FilterField(entityField = "status", operator = FilterOperator.EQUAL)
    SprintStatus status;

    @FilterField(entityField = "startDate", operator = FilterOperator.GREATER_OR_EQUAL)
    LocalDate startFrom;

    @FilterField(entityField = "endDate", operator = FilterOperator.LESS_OR_EQUAL)
    LocalDate endTo;
}
