package com.example.starter_project_2025.base.crud.mapper;

import com.example.starter_project_2025.base.crud.domain.Department;
import com.example.starter_project_2025.base.crud.dto.DepartmentDTO;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(config = BaseMapperConfig.class)
public interface DepartmentMapper extends BaseCrudMapper<Department, DepartmentDTO> {

    @Override
    @Mapping(target = "parentDepartmentId", source = "parent.id")
    @Mapping(target = "parentDepartmentName", source = "parent.name")
    DepartmentDTO toResponse(Department entity);

    @Override
    @Mapping(target = "parent", ignore = true)
    Department toEntity(DepartmentDTO dto);
}