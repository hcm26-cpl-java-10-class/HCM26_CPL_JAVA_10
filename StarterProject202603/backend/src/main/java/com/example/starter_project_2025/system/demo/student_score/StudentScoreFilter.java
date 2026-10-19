package com.example.starter_project_2025.system.demo.student_score;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Builder;

@Builder
public class StudentScoreFilter extends BaseFilter {

    @FilterField(entityField = "studentCode", operator = FilterOperator.LIKE)
    String studentCode;

    @FilterField(entityField = "studentName", operator = FilterOperator.LIKE)
    String studentName;

    @FilterField(entityField = "className", operator = FilterOperator.LIKE)
    String className;
}
