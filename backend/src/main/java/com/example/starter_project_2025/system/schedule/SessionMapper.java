package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;

import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface SessionMapper extends BaseCrudMapper<Session, SessionDTO> {

    @Override
    @Mapping(source = "calendarVersion.id", target = "calendarVersionId")
    SessionDTO toResponse(Session entity);

    @Override
    @IgnoreAuditFields
    Session toEntity(SessionDTO dto);
}
