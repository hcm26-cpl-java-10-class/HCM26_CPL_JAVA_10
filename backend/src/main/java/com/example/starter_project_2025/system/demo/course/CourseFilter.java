package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourseFilter extends BaseFilter {

    @FilterField(entityField = "categories.id")
    private Long categoryId;

    @FilterField(entityField = "status")
    private CourseStatus status;

    @FilterField(entityField = "level")
    private CourseLevel level;
}
