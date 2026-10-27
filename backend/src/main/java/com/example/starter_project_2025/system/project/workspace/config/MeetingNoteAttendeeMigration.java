package com.example.starter_project_2025.system.project.workspace.config;

import com.example.starter_project_2025.system.project.workspace.domain.MeetingNoteAttendee;
import com.example.starter_project_2025.system.project.workspace.domain.ProjectLog;
import com.example.starter_project_2025.system.project.workspace.repository.MeetingNoteAttendeeRepository;
import com.example.starter_project_2025.system.project.workspace.repository.ProjectLogRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@Order(5)
@RequiredArgsConstructor
public class MeetingNoteAttendeeMigration implements CommandLineRunner {
    private final JdbcTemplate jdbc;
    private final ProjectLogRepository logs;
    private final MeetingNoteAttendeeRepository attendees;
    private final UserRepository users;

    @Override
    @Transactional
    public void run(String... args) {
        List<Map<String, Object>> records = jdbc.queryForList(
                "SELECT id, attendees FROM project_logs WHERE log_type = 'MEETING_NOTE' AND attendees IS NOT NULL");
        for (Map<String, Object> record : records) {
            Long logId = ((Number) record.get("id")).longValue();
            String legacyValue = (String) record.get("attendees");
            ProjectLog meetingNote = logs.findById(logId).orElse(null);
            if (meetingNote == null) continue;
            Arrays.stream(legacyValue.trim().replaceAll("^\\|+|\\|+$", "").split("\\|"))
                    .filter(token -> !token.isBlank())
                    .forEach(token -> migrateAttendee(logId, meetingNote, token));
        }
    }

    private void migrateAttendee(Long logId, ProjectLog meetingNote, String token) {
        final Long userId;
        try {
            userId = Long.valueOf(token);
        } catch (NumberFormatException exception) {
            log.warn("Skipping malformed legacy meeting attendee; meetingNoteId={}", logId);
            return;
        }
        if (attendees.existsByMeetingNote_IdAndUser_Id(logId, userId)) return;
        users.findById(userId).ifPresentOrElse(
                user -> attendees.save(MeetingNoteAttendee.create(meetingNote, user)),
                () -> log.warn("Skipping deleted legacy meeting attendee; meetingNoteId={}, userId={}", logId, userId));
    }
}
