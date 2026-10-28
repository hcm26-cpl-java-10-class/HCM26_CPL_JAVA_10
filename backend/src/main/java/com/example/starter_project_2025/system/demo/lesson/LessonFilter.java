package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class LessonFilter extends BaseFilter {

    @FilterField(entityField = "section.id")
    private Long sectionId;

    @FilterField(entityField = "contentType")
    private LessonContentType contentType;
}
