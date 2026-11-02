package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.demo.session.Session;
import java.time.LocalDateTime;

/** Assignment readers receive schedule information, not private session notes. */
public record TeachingAssignmentSessionResponse(
        Long id,
        String title,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String location,
        Long roomId,
        String meetingUrl,
        Session.SessionStatus status,
        boolean active,
        com.example.starter_project_2025.system.schedule.ScheduleEntryKey.Source source
) {
    public static TeachingAssignmentSessionResponse from(Session session) {
        return new TeachingAssignmentSessionResponse(session.getId(), session.getTitle(), session.getStartTime(),
                session.getEndTime(), session.getLocation(), session.getRoomId(), session.getMeetingUrl(),
                session.getStatus(), Boolean.TRUE.equals(session.getIsActive()),
                com.example.starter_project_2025.system.schedule.ScheduleEntryKey.Source.DEMO_SESSION);
    }
}
