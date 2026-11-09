package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class ExamFilter extends BaseFilter {
    @FilterField(entityField = "title", operator = FilterOperator.LIKE)
    private String title;

    @FilterField(entityField = "category", operator = FilterOperator.EQUAL)
    private ExamCategory category;

    @FilterField(entityField = "course.id", operator = FilterOperator.EQUAL)
    private Long courseId;

    @FilterField(entityField = "section.id", operator = FilterOperator.EQUAL)
    private Long sectionId;

    @FilterField(entityField = "lesson.id", operator = FilterOperator.EQUAL)
    private Long lessonId;
}