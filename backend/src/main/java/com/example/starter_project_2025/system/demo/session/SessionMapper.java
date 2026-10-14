package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.mapper.*;
import org.mapstruct.*;

@Mapper(config = BaseMapperConfig.class)
public interface SessionMapper extends BaseCrudMapper<Session, SessionDTO> {
    @Override
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "calendarVersionId", source = "calendarVersionId")
    @Mapping(target = "topicId", source = "topicId")
    @Mapping(target = "trainerId", source = "trainerId")
    @Mapping(target = "title", source = "title")
    @Mapping(target = "startTime", source = "startTime")
    @Mapping(target = "endTime", source = "endTime")
    @Mapping(target = "location", source = "location")
    @Mapping(target = "note", source = "note")
    Session toEntity(SessionDTO dto);

    @Override
    @BeanMapping(ignoreByDefault = true, nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "topicId", source = "topicId")
    @Mapping(target = "trainerId", source = "trainerId")
    @Mapping(target = "title", source = "title")
    @Mapping(target = "startTime", source = "startTime")
    @Mapping(target = "endTime", source = "endTime")
    @Mapping(target = "location", source = "location")
    @Mapping(target = "note", source = "note")
    void update(@MappingTarget Session entity, SessionDTO dto);

    default SessionDTO toDto(Session entity) { return toResponse(entity); }
}
