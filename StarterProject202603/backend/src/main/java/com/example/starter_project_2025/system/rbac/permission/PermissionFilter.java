package com.example.starter_project_2025.system.rbac.permission;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Builder;

@Builder
public class PermissionFilter extends BaseFilter {

        @FilterField(entityField = "resource", operator = FilterOperator.LIKE)
        String resource;

        @FilterField(entityField = "action", operator = FilterOperator.LIKE)
        String action;
}
