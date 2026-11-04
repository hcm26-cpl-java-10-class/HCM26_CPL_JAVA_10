package com.example.starter_project_2025.system.rbac.department;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentFilter extends BaseFilter {

    @FilterField(entityField = "parentDepartment.id")
    Long parentDepartmentId;
}
