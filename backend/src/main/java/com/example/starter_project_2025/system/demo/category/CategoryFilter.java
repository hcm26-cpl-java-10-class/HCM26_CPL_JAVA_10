package com.example.starter_project_2025.system.demo.category;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class CategoryFilter extends BaseFilter {

    @FilterField(entityField = "name", operator = FilterOperator.LIKE)
    String name;

    @FilterField(entityField = "code", operator = FilterOperator.LIKE)
    String code;

    @FilterField(entityField = "parent.id", operator = FilterOperator.IN)
    List<Long> parentId;
}