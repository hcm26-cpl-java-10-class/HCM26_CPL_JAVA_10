package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class ExamFilter extends BaseFilter {
    @FilterField(entityField = "title", operator = FilterOperator.LIKE)
    private String title;
}