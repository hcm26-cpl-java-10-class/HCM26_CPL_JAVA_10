package com.example.starter_project_2025.system.demo.department;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface DepartmentMapper
        extends BaseCrudMapper<Department, DepartmentDTO> {

    @Override
    @IgnoreAuditFields
    Department toEntity(DepartmentDTO dto);

    @Override
    DepartmentDTO toResponse(Department entity);
}