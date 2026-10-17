package com.example.starter_project_2025.system.schedule.session;

import org.springframework.security.core.Authentication;

import java.util.Optional;

public interface SessionReadContextProvider {

    Optional<ReadContext> findReadableContext(
            Long calendarVersionId, Long topicId, Long trainerId, Authentication actor);

    record ReadContext(
            Long calendarVersionNumber,
            String calendarVersionStatus,
            Long classId,
            String classCode,
            String topicName,
            String trainerName
    ) {}
}
