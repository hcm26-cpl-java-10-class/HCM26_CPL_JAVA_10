package com.example.starter_project_2025.system.demo.subject;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface SubjectMapper extends BaseCrudMapper<Subject, SubjectDTO> {

    @Override
    @IgnoreAuditFields
    Subject toEntity(SubjectDTO dto);

    SubjectDTO toDto(Subject entity);
}
