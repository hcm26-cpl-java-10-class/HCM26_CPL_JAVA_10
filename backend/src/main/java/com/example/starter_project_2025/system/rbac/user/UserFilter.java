package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserFilter extends BaseFilter {

        @FilterField(entityField = "roles.id", operator = FilterOperator.IN)
        List<Long> roleIds;

        @FilterField(entityField = "departments.id", operator = FilterOperator.IN)
        List<Long> departmentIds;
}
