package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Builder;

import java.util.List;

@Builder
public class UserFilter extends BaseFilter {

        @FilterField(entityField = "userRoles.role.id", operator = FilterOperator.IN)
        List<Long> roleIds;
}
