package com.example.starter_project_2025.system.demo.course_assessment;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface AssessmentMapper extends BaseCrudMapper<Assessment, AssessmentDTO> {
    @Override
    @IgnoreAuditFields
    Assessment toEntity(AssessmentDTO dto);
}
