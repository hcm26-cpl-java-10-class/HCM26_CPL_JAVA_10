package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface StudentMapper extends BaseCrudMapper<Student, StudentDTO> {
    @Override
    @IgnoreAuditFields
    Student toEntity(StudentDTO dto);
}
