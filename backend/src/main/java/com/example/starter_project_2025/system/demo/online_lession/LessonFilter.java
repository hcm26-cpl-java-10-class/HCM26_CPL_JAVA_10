package com.example.starter_project_2025.system.demo.online_lession;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Builder;

@Builder
public class LessonFilter extends BaseFilter {

    @FilterField(entityField = "course.id")
    Long courseId;

    @FilterField(entityField = "title", operator = FilterOperator.LIKE)
    String title;
}
