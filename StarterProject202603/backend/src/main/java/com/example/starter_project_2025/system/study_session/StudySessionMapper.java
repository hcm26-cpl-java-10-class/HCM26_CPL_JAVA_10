package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface StudySessionMapper extends BaseCrudMapper<StudySession, StudySessionDTO> {

    @Override
    @IgnoreAuditFields
    StudySession toEntity(StudySessionDTO dto);
}