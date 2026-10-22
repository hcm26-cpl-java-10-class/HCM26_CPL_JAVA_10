package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Builder;

@Builder
public class StudentFilter extends BaseFilter {
    @FilterField(entityField = "studentCode", operator = FilterOperator.LIKE)
    String studentCode;
    @FilterField(entityField = "firstName", operator = FilterOperator.LIKE)
    String firstName;
    @FilterField(entityField = "lastName", operator = FilterOperator.LIKE)
    String lastName;
    @FilterField(entityField = "email", operator = FilterOperator.LIKE)
    String email;
    @FilterField(entityField = "className", operator = FilterOperator.LIKE)
    String className;
    @FilterField(entityField = "status", operator = FilterOperator.EQUAL)
    String status;
}
