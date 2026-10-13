package com.example.starter_project_2025.system.demo.subject;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubjectFilter extends BaseFilter {

    @FilterField(entityField = "code", operator = FilterOperator.LIKE)
    String code;

    @FilterField(entityField = "name", operator = FilterOperator.LIKE)
    String name;

    @FilterField(entityField = "credits", operator = FilterOperator.EQUAL)
    Integer credits;
}
