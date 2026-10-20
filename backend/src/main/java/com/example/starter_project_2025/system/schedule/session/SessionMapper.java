package com.example.starter_project_2025.system.schedule.session;

import org.mapstruct.BeanMapping;
import org.mapstruct.NullValuePropertyMappingStrategy;

import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;

import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface SessionMapper extends BaseCrudMapper<Session, SessionDTO> {

    @Override
    @Mapping(source = "calendarVersion.id", target = "calendarVersionId")
    @Mapping(source = "calendarVersion.versionNumber", target = "calendarVersionNumber")
    @Mapping(source = "calendarVersion.status", target = "calendarVersionStatus")
    @Mapping(source = "calendarVersion.calendar.classId", target = "classId")
    SessionDTO toResponse(Session entity);

    @Override
    @IgnoreAuditFields
    @Mapping(target = "calendarVersion", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "cancelReason", ignore = true)
    @Mapping(target = "version", ignore = true)
    @Mapping(target = "isOverridden", ignore = true)
    @Mapping(target = "overrideReason", ignore = true)
    @Mapping(target = "isActive", ignore = true)
    Session toEntity(SessionDTO dto);

    @Override
    @IgnoreAuditFields
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "calendarVersion", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "cancelReason", ignore = true)
    @Mapping(target = "version", ignore = true)
    @Mapping(target = "isOverridden", ignore = true)
    @Mapping(target = "overrideReason", ignore = true)
    @Mapping(target = "isActive", ignore = true)
    void update(@MappingTarget Session entity, SessionDTO dto);
}
