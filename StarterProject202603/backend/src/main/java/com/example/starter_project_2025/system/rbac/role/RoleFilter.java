package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Builder;

import java.util.List;

@Builder
public class RoleFilter extends BaseFilter {

        @FilterField(entityField = "permissions.id", operator = FilterOperator.IN)
        List<Long> permissionIds;
}
