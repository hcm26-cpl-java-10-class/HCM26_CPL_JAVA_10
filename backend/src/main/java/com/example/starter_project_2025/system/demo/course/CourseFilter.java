package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import lombok.Builder;

@lombok.Getter
@lombok.Setter
@lombok.NoArgsConstructor
@lombok.AllArgsConstructor
@Builder
public class CourseFilter extends BaseFilter {
 @com.example.starter_project_2025.base.crud.spec.FilterField(entityField="category",operator=com.example.starter_project_2025.base.crud.spec.FilterOperator.LIKE) String category;
 @com.example.starter_project_2025.base.crud.spec.FilterField(entityField="courseLevel") String courseLevel;
 @com.example.starter_project_2025.base.crud.spec.FilterField(entityField="publicationStatus") String publicationStatus;
 @com.example.starter_project_2025.base.crud.spec.FilterField(entityField="instructor") String instructor;

}
