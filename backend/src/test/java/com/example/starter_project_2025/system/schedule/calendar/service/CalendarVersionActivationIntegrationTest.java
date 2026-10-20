package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionMapper;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarVersionResponse;
import com.example.starter_project_2025.system.schedule.calendar.exception.CalendarActivationConflictException;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.detection.ConflictDetectionService;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictDTO;
import com.example.starter_project_2025.system.schedule.conflict_resolution.ConflictResolutionServiceImpl;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@DataJpaTest
@Import({
        CalendarVersionServiceImpl.class,
        ConflictResolutionServiceImpl.class,
        CalendarVersionActivationIntegrationTest.FixedClockConfig.class
})
class CalendarVersionActivationIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-10-20T07:30:00Z");

    @Autowired
    private CalendarVersionService calendarVersionService;

    @Autowired
    private CalendarRepository calendarRepository;

    @Autowired
    private CalendarVersionRepository calendarVersionRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private EntityManager entityManager;

    @MockBean
    private ConflictDetectionService conflictDetectionService;

    @MockBean
    private CalendarVersionMapper calendarVersionMapper;

    @Test
    void shouldPersistActivationAndDeactivatePreviousVersion() {
        ActivationFixture fixture = createFixture(81001L);
        when(conflictDetectionService.checkConflicts(fixture.draft().getId()))
                .thenReturn(noConflicts(fixture.draft().getId()));
        when(calendarVersionMapper.toResponse(any(CalendarVersion.class)))
                .thenReturn(new CalendarVersionResponse());

        calendarVersionService.activateVersion(
                fixture.calendar().getId(),
                fixture.draft().getId(),
                77L
        );

        entityManager.flush();
        entityManager.clear();

        CalendarVersion previousActive = calendarVersionRepository
                .findById(fixture.active().getId())
                .orElseThrow();
        CalendarVersion activated = calendarVersionRepository
                .findById(fixture.draft().getId())
                .orElseThrow();

        assertEquals(CalendarVersionStatus.INACTIVE, previousActive.getStatus());
        assertEquals(CalendarVersionStatus.ACTIVE, activated.getStatus());
        assertEquals(77L, activated.getActivatedBy());
        assertEquals(LocalDateTime.ofInstant(NOW, ZoneOffset.UTC), activated.getActivatedAt());
    }

    @Test
    void shouldLeaveVersionStatesUnchangedWhenConflictDetectionBlocksActivation() {
        ActivationFixture fixture = createFixture(81002L);
        when(conflictDetectionService.checkConflicts(fixture.draft().getId()))
                .thenReturn(ConflictCheckResult.builder()
                        .calendarVersionId(fixture.draft().getId())
                        .hasConflict(true)
                        .hasBlockingConflict(true)
                        .conflicts(List.of(new ConflictDTO()))
                        .build());

        assertThrows(
                CalendarActivationConflictException.class,
                () -> calendarVersionService.activateVersion(
                        fixture.calendar().getId(),
                        fixture.draft().getId(),
                        77L
                )
        );

        entityManager.clear();

        assertEquals(
                CalendarVersionStatus.ACTIVE,
                calendarVersionRepository.findById(fixture.active().getId())
                        .orElseThrow()
                        .getStatus()
        );
        assertEquals(
                CalendarVersionStatus.DRAFT,
                calendarVersionRepository.findById(fixture.draft().getId())
                        .orElseThrow()
                        .getStatus()
        );
    }

    private ActivationFixture createFixture(Long classId) {
        Calendar calendar = calendarRepository.saveAndFlush(Calendar.builder()
                .classId(classId)
                .name("Calendar " + classId)
                .lastIssuedVersionNumber(2)
                .isActive(true)
                .build());

        CalendarVersion active = calendarVersionRepository.saveAndFlush(
                CalendarVersion.builder()
                        .calendar(calendar)
                        .versionNumber(1)
                        .status(CalendarVersionStatus.ACTIVE)
                        .name("Active")
                        .isActive(true)
                        .build()
        );
        CalendarVersion draft = calendarVersionRepository.saveAndFlush(
                CalendarVersion.builder()
                        .calendar(calendar)
                        .versionNumber(2)
                        .status(CalendarVersionStatus.DRAFT)
                        .name("Draft")
                        .isActive(true)
                        .build()
        );

        sessionRepository.saveAndFlush(Session.builder()
                .calendarVersion(draft)
                .classCode("CLASS-" + classId)
                .trainerId(101L)
                .trainerName("Trainer T01")
                .title("Session")
                .startTime(LocalDateTime.of(2026, 10, 21, 9, 0))
                .endTime(LocalDateTime.of(2026, 10, 21, 11, 0))
                .room("R01")
                .status(SessionStatus.SCHEDULED)
                .isActive(true)
                .build());

        return new ActivationFixture(calendar, active, draft);
    }

    private ConflictCheckResult noConflicts(Long versionId) {
        return ConflictCheckResult.builder()
                .calendarVersionId(versionId)
                .hasConflict(false)
                .build();
    }

    private record ActivationFixture(
            Calendar calendar,
            CalendarVersion active,
            CalendarVersion draft
    ) {
    }

    @TestConfiguration
    static class FixedClockConfig {

        @Bean
        Clock clock() {
            return Clock.fixed(NOW, ZoneOffset.UTC);
        }
    }
}
