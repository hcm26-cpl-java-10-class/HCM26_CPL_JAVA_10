package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.BeanMapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface StudySessionMapper extends BaseCrudMapper<StudySession, StudySessionDTO> {

    // Scalar link fields map by name in both directions. Null updates preserve existing values.

    @Override
    @IgnoreAuditFields
    @Mapping(target = "subject", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "cancelReason", ignore = true)
    StudySession toEntity(StudySessionDTO dto);

    @Override
    @Mapping(target = "subjectName", source = "subject.name")
    StudySessionDTO toResponse(StudySession entity);

    @Override
    @IgnoreAuditFields
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "cancelReason", ignore = true)
    @Mapping(target = "subject", ignore = true)
    void update(@MappingTarget StudySession entity, StudySessionDTO dto);
}
