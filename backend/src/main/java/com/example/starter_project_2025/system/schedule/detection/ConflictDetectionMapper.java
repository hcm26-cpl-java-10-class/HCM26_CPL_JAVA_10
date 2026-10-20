package com.example.starter_project_2025.system.schedule.detection;

import com.example.starter_project_2025.system.schedule.detection.dto.ConflictDTO;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionMapper;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.Set;

@Mapper(componentModel = "spring", uses = SessionMapper.class)
public interface ConflictDetectionMapper {

    @Mapping(source = "session", target = "session")
    @Mapping(source = "conflictingSession", target = "conflictingSession")
    @Mapping(source = "conflictTypes", target = "conflictTypes")
    ConflictDTO toDto(
            Session session,
            Session conflictingSession,
            Set<ConflictType> conflictTypes
    );
}
