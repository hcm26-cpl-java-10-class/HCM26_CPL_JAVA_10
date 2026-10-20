package com.example.starter_project_2025.system.schedule;

import java.time.LocalDateTime;

/** A complete proposed session; id is set only when replacing an existing session. */
public record ScheduleCandidate(Long id, Long classId, Long topicId, Long trainerId,
        Long teachingAssignmentId, Long roomId, String location, String meetingUrl,
        String title, LocalDateTime startTime, LocalDateTime endTime) {}
