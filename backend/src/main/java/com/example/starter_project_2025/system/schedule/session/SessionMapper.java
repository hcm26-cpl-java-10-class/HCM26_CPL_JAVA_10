package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.system.schedule.session.dto.SessionResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(config = BaseMapperConfig.class)
public interface SessionMapper {

    @Mapping(target = "calendarVersionNumber", source = "context.calendarVersionNumber")
    @Mapping(target = "calendarVersionStatus", source = "context.calendarVersionStatus")
    @Mapping(target = "classId", source = "context.classId")
    @Mapping(target = "classCode", source = "context.classCode")
    @Mapping(target = "topicName", source = "context.topicName")
    @Mapping(target = "trainerName", source = "context.trainerName")
    SessionResponse toResponse(Session session, SessionReadContextProvider.ReadContext context);
}
