package com.example.starter_project_2025.system.schedule.detection;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest
class ConflictDetectionRepositoryTest {

    @Autowired
    private CalendarRepository calendarRepository;

    @Autowired
    private CalendarVersionRepository calendarVersionRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private ConflictDetectionRepository conflictDetectionRepository;

    @Test
    void shouldLoadDraftAndOnlyActiveSessionsFromOtherClasses() {
        Calendar java01 = saveCalendar(1001L, "Java 01");
        CalendarVersion java01Draft = saveVersion(java01, 2, CalendarVersionStatus.DRAFT);
        CalendarVersion java01Active = saveVersion(java01, 1, CalendarVersionStatus.ACTIVE);

        Calendar java02 = saveCalendar(1002L, "Java 02");
        CalendarVersion java02Active = saveVersion(java02, 1, CalendarVersionStatus.ACTIVE);
        CalendarVersion java02Draft = saveVersion(java02, 2, CalendarVersionStatus.DRAFT);

        Session targetDraft = saveSession(java01Draft, 1L, "R01", SessionStatus.SCHEDULED, true);
        saveSession(java01Active, 1L, "R02", SessionStatus.SCHEDULED, true);
        Session expectedOtherActive = saveSession(java02Active, 1L, "R03", SessionStatus.SCHEDULED, true);
        saveSession(java02Draft, 1L, "R04", SessionStatus.SCHEDULED, true);
        saveSession(java02Active, 1L, "R05", SessionStatus.CANCELLED, true);
        saveSession(java02Active, 1L, "R06", SessionStatus.SCHEDULED, false);

        List<Session> draftSessions = conflictDetectionRepository
                .findSessionsInDraft(java01Draft.getId());
        List<Session> otherActiveSessions = conflictDetectionRepository
                .findSessionsInActiveVersionsOfOtherClasses(java01.getClassId());

        assertEquals(List.of(targetDraft.getId()),
                draftSessions.stream().map(Session::getId).toList());
        assertEquals(List.of(expectedOtherActive.getId()),
                otherActiveSessions.stream().map(Session::getId).toList());
    }

    private Calendar saveCalendar(Long classId, String name) {
        return calendarRepository.save(Calendar.builder()
                .classId(classId)
                .name(name)
                .lastIssuedVersionNumber(2)
                .isActive(true)
                .build());
    }

    private CalendarVersion saveVersion(
            Calendar calendar,
            int versionNumber,
            CalendarVersionStatus status
    ) {
        return calendarVersionRepository.save(CalendarVersion.builder()
                .calendar(calendar)
                .versionNumber(versionNumber)
                .status(status)
                .name(calendar.getName() + " v" + versionNumber)
                .isActive(true)
                .build());
    }

    private Session saveSession(
            CalendarVersion version,
            Long trainerId,
            String room,
            SessionStatus status,
            boolean active
    ) {
        return sessionRepository.save(Session.builder()
                .calendarVersion(version)
                .classCode(version.getCalendar().getName())
                .trainerId(trainerId)
                .trainerName("Trainer " + trainerId)
                .title("Test session " + room)
                .startTime(LocalDateTime.of(2026, 10, 20, 9, 0))
                .endTime(LocalDateTime.of(2026, 10, 20, 11, 0))
                .room(room)
                .status(status)
                .isActive(active)
                .build());
    }
}
