package com.example.starter_project_2025.system.resource_assignment.mapper;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import com.example.starter_project_2025.system.resource_assignment.domain.ClassResourceAssignment;
import com.example.starter_project_2025.system.resource_assignment.dto.ClassResourceAssignmentDTO;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface ClassResourceAssignmentMapper extends BaseCrudMapper<ClassResourceAssignment, ClassResourceAssignmentDTO> {

    @Override
    @IgnoreAuditFields
    ClassResourceAssignment toEntity(ClassResourceAssignmentDTO dto);
}