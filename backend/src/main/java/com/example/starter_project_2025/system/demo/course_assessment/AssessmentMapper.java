package com.example.starter_project_2025.system.demo.course_assessment;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface AssessmentMapper extends BaseCrudMapper<Assessment, AssessmentDTO> {
    @Override
    @IgnoreAuditFields
    @Mapping(target = "course", ignore = true)
    Assessment toEntity(AssessmentDTO dto);

    @Mapping(source = "course.id", target = "courseId")
    @Mapping(source = "course.name", target = "courseName")
    AssessmentDTO toResponse(Assessment entity);
}
