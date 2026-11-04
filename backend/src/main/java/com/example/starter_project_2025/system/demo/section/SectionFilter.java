
package com.example.starter_project_2025.system.demo.section;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SectionFilter extends BaseFilter {

    @FilterField(entityField = "course.id")
    private Long courseId;
}
