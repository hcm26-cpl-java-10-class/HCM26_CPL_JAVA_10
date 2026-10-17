package com.example.starter_project_2025.system.schedule.session;

import org.springframework.security.core.Authentication;

import java.time.LocalDate;
import java.util.Optional;
import java.util.Set;

public interface SessionCreateContextProvider {

    Optional<CalendarVersionContext> lockCalendarVersion(Long calendarVersionId, Authentication actor);

    Optional<TopicContext> findTopic(Long topicId, Authentication actor);

    Optional<TrainerContext> findTrainer(Long trainerId, Long classId, Long topicId, Authentication actor);

    record CalendarVersionContext(
            Long versionNumber, String status, Long classId, String classCode, Long programId,
            LocalDate classStartDate, LocalDate classEndDate, Set<LocalDate> holidays, boolean canCreate) {}

    record TopicContext(Long programId, String name) {}

    record TrainerContext(String fullName, boolean assigned) {}
}
