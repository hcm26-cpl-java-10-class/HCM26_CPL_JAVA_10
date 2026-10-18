package com.example.starter_project_2025.base.crud.mapper;

import com.example.starter_project_2025.base.crud.domain.Department;
import com.example.starter_project_2025.base.crud.dto.DepartmentDTO;
import com.example.starter_project_2025.base.crud.dto.DepartmentRequest;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(config = BaseMapperConfig.class)
public interface DepartmentMapper extends BaseCrudMapper<Department, DepartmentDTO, DepartmentRequest, DepartmentRequest> {

    @Override
    @Mapping(target = "parentDepartmentId", source = "parent.id")
    @Mapping(target = "parentDepartmentName", source = "parent.name")
    DepartmentDTO toDto(Department entity);
}