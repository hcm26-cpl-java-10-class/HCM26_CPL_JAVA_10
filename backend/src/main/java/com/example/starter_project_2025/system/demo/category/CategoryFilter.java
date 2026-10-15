package com.example.starter_project_2025.system.demo.category;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CategoryFilter extends BaseFilter {

    @FilterField(entityField = "parent.id")
    private Long parentId;
}