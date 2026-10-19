package com.example.starter_project_2025.system.subject;

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

    @FilterField(entityField = "version", operator = FilterOperator.EQUAL)
    String version;

    @FilterField(entityField = "technicalGroup", operator = FilterOperator.LIKE)
    String technicalGroup;

    @FilterField(entityField = "status", operator = FilterOperator.EQUAL)
    SubjectStatus status;
    @FilterField(entityField = "technicalGroup", operator = FilterOperator.EQUAL)
    String technicalGroup;

    @FilterField(entityField = "version", operator = FilterOperator.EQUAL)
    String version;
}
