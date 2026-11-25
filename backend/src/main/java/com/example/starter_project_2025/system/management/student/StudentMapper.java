package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;

import org.mapstruct.*;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface StudentMapper extends BaseCrudMapper<Student, StudentDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "passwordHash", ignore = true)
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "mustChangePassword", ignore = true)
    Student toEntity(StudentDTO dto);

    @Override
    StudentDTO toResponse(Student entity);

    @Override
    @IgnoreAuditFields
    @Mapping(target = "passwordHash", ignore = true)
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "mustChangePassword", ignore = true)
    @BeanMapping(
            nullValuePropertyMappingStrategy =
                    NullValuePropertyMappingStrategy.IGNORE
    )
    void update(
            @MappingTarget Student entity,
            StudentDTO dto
    );
}