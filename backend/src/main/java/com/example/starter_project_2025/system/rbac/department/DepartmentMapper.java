package com.example.starter_project_2025.system.rbac.department;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.*;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface DepartmentMapper extends BaseCrudMapper<Department, DepartmentDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "parentDepartment", ignore = true)
    Department toEntity(DepartmentDTO request);

    @Override
    @Mapping(target = "parentDepartmentId", source = "parentDepartment.id")
    @Mapping(target = "parentDepartmentName", source = "parentDepartment.name")
    DepartmentDTO toResponse(Department department);

    @Override
    @Mapping(target = "parentDepartment", ignore = true)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void update(@MappingTarget Department department, DepartmentDTO request);
}
