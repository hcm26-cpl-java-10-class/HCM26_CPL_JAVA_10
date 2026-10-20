package com.example.starter_project_2025.system.schedule.conflict_resolution;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.ConflictResolutionResponse;
import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.CreateConflictResolutionRequest;
import com.example.starter_project_2025.system.schedule.detection.ConflictDetectionMapperImpl;
import com.example.starter_project_2025.system.schedule.detection.ConflictDetectionService;
import com.example.starter_project_2025.system.schedule.detection.ConflictDetectionServiceImpl;
import com.example.starter_project_2025.system.schedule.detection.ConflictType;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionMapperImpl;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest
@Import({
        ConflictDetectionServiceImpl.class,
        ConflictResolutionServiceImpl.class,
        ConflictDetectionMapperImpl.class,
        SessionMapperImpl.class,
        ConflictResolutionIntegrationTest.FixedClockConfig.class
})
class ConflictResolutionIntegrationTest {

    @Autowired
    CalendarRepository calendarRepository;

    @Autowired
    CalendarVersionRepository calendarVersionRepository;

    @Autowired
    SessionRepository sessionRepository;

    @Autowired
    ConflictDetectionService conflictDetectionService;

    @Autowired
    ConflictResolutionService conflictResolutionService;

    @Autowired
    EntityManager entityManager;

    @Test
    void acknowledgementMustRemainBlocking() {
        Fixture fixture = createFixture(101L, 101L, "R01");

        ConflictResolutionResponse response = conflictResolutionService.create(
                fixture.draft().getId(),
                request(fixture, ConflictResolutionReason.ACKNOWLEDGED_PENDING_RESOLUTION),
                11L
        );

        ConflictCheckResult result = resolvedCheck(fixture.draft().getId());

        assertEquals(ConflictResolutionStatus.ACKNOWLEDGED, response.getStatus());
        assertTrue(result.isHasBlockingConflict());
        assertFalse(result.isCanActivate());
        assertEquals(1, result.getAcknowledgedCount());
        assertTrue(result.getConflicts().getFirst().isBlocking());
    }

    @Test
    void approvedSharedSessionMustWaiveTrainerAndRoomConflict() {
        Fixture fixture = createFixture(101L, 101L, "R01");

        ConflictResolutionResponse pending = conflictResolutionService.create(
                fixture.draft().getId(),
                request(fixture, ConflictResolutionReason.SHARED_CLASS_SESSION),
                11L
        );
        ConflictResolutionResponse approved = conflictResolutionService.approve(
                fixture.draft().getId(),
                pending.getId(),
                22L
        );
        ConflictCheckResult result = resolvedCheck(fixture.draft().getId());

        assertEquals(ConflictResolutionStatus.APPROVED, approved.getStatus());
        assertFalse(result.isHasBlockingConflict());
        assertTrue(result.isCanActivate());
        assertEquals(1, result.getApprovedOverrideCount());
        assertEquals(
                java.util.Set.of(ConflictType.TRAINER_CONFLICT, ConflictType.ROOM_CONFLICT),
                result.getConflicts().getFirst().getWaivedConflictTypes()
        );

        conflictResolutionService.markApplied(result, 33L);
        ConflictResolutionResponse applied = conflictResolutionService.get(
                fixture.draft().getId(),
                pending.getId()
        );
        assertEquals(ConflictResolutionStatus.APPLIED, applied.getStatus());
        assertEquals(3, applied.getAuditTrail().size());
    }

    @Test
    void approvedRoomPartitionMustWaiveRoomOnly() {
        Fixture fixture = createFixture(101L, 202L, "Hall A");

        CreateConflictResolutionRequest request = request(
                fixture,
                ConflictResolutionReason.ROOM_PARTITIONED
        );
        request.setSessionArea("Hall A - Zone 1");
        request.setConflictingSessionArea("Hall A - Zone 2");

        ConflictResolutionResponse pending = conflictResolutionService.create(
                fixture.draft().getId(),
                request,
                11L
        );
        conflictResolutionService.approve(fixture.draft().getId(), pending.getId(), 22L);
        ConflictCheckResult result = resolvedCheck(fixture.draft().getId());

        assertFalse(result.isHasBlockingConflict());
        assertEquals(
                java.util.Set.of(ConflictType.ROOM_CONFLICT),
                result.getConflicts().getFirst().getWaivedConflictTypes()
        );
    }

    @Test
    void sessionChangeMustMakeApprovedResolutionStaleAndBlocking() {
        Fixture fixture = createFixture(101L, 101L, "R01");
        ConflictResolutionResponse pending = conflictResolutionService.create(
                fixture.draft().getId(),
                request(fixture, ConflictResolutionReason.SHARED_CLASS_SESSION),
                11L
        );
        conflictResolutionService.approve(fixture.draft().getId(), pending.getId(), 22L);

        fixture.draftSession().setTitle("Changed after approval");
        sessionRepository.saveAndFlush(fixture.draftSession());
        entityManager.clear();

        ConflictCheckResult result = resolvedCheck(fixture.draft().getId());

        assertTrue(result.isHasBlockingConflict());
        assertEquals(
                ConflictResolutionStatus.STALE,
                result.getConflicts().getFirst().getResolutionStatus()
        );
        assertTrue(result.getConflicts().getFirst().getWaivedConflictTypes().isEmpty());

        Session refreshedDraftSession = sessionRepository
                .findByIdAndIsActiveTrue(fixture.draftSession().getId())
                .orElseThrow();
        Session refreshedActiveSession = sessionRepository
                .findByIdAndIsActiveTrue(fixture.activeSession().getId())
                .orElseThrow();
        CreateConflictResolutionRequest replacementRequest = request(
                fixture,
                ConflictResolutionReason.SHARED_CLASS_SESSION
        );
        replacementRequest.setSessionVersion(refreshedDraftSession.getVersion());
        replacementRequest.setConflictingSessionVersion(refreshedActiveSession.getVersion());

        ConflictResolutionResponse replacement = conflictResolutionService.create(
                fixture.draft().getId(),
                replacementRequest,
                33L
        );
        ConflictCheckResult resultWithReplacement = resolvedCheck(fixture.draft().getId());

        assertEquals(ConflictResolutionStatus.PENDING, replacement.getStatus());
        assertEquals(
                replacement.getId(),
                resultWithReplacement.getConflicts().getFirst().getResolutionId()
        );
        assertEquals(
                ConflictResolutionStatus.PENDING,
                resultWithReplacement.getConflicts().getFirst().getResolutionStatus()
        );
    }

    private ConflictCheckResult resolvedCheck(Long versionId) {
        return conflictResolutionService.resolve(conflictDetectionService.checkConflicts(versionId));
    }

    private CreateConflictResolutionRequest request(
            Fixture fixture,
            ConflictResolutionReason reason
    ) {
        return CreateConflictResolutionRequest.builder()
                .sessionId(fixture.draftSession().getId())
                .conflictingSessionId(fixture.activeSession().getId())
                .reasonCode(reason)
                .justification("Approved business exception for integration test")
                .referenceCode("REF-2026-001")
                .sessionVersion(fixture.draftSession().getVersion())
                .conflictingSessionVersion(fixture.activeSession().getVersion())
                .build();
    }

    private Fixture createFixture(Long draftTrainerId, Long activeTrainerId, String room) {
        Calendar draftCalendar = saveCalendar(91001L);
        CalendarVersion draft = saveVersion(draftCalendar, CalendarVersionStatus.DRAFT);
        Session draftSession = saveSession(draft, draftTrainerId, room, "DRAFT");

        Calendar activeCalendar = saveCalendar(91002L);
        CalendarVersion active = saveVersion(activeCalendar, CalendarVersionStatus.ACTIVE);
        Session activeSession = saveSession(active, activeTrainerId, room, "ACTIVE");

        return new Fixture(draft, draftSession, activeSession);
    }

    private Calendar saveCalendar(Long classId) {
        return calendarRepository.saveAndFlush(Calendar.builder()
                .classId(classId)
                .name("Calendar " + classId)
                .lastIssuedVersionNumber(1)
                .isActive(true)
                .build());
    }

    private CalendarVersion saveVersion(Calendar calendar, CalendarVersionStatus status) {
        return calendarVersionRepository.saveAndFlush(CalendarVersion.builder()
                .calendar(calendar)
                .versionNumber(1)
                .name(status + " version")
                .status(status)
                .isActive(true)
                .build());
    }

    private Session saveSession(
            CalendarVersion version,
            Long trainerId,
            String room,
            String label
    ) {
        return sessionRepository.saveAndFlush(Session.builder()
                .calendarVersion(version)
                .classCode(label)
                .trainerId(trainerId)
                .trainerName("Trainer " + trainerId)
                .title(label + " shared session")
                .startTime(LocalDateTime.of(2026, 11, 3, 9, 0))
                .endTime(LocalDateTime.of(2026, 11, 3, 11, 0))
                .room(room)
                .status(SessionStatus.SCHEDULED)
                .isActive(true)
                .build());
    }

    private record Fixture(
            CalendarVersion draft,
            Session draftSession,
            Session activeSession
    ) {
    }

    @TestConfiguration
    static class FixedClockConfig {
        @Bean
        Clock clock() {
            return Clock.fixed(
                    Instant.parse("2026-10-21T02:00:00Z"),
                    ZoneOffset.UTC
            );
        }
    }
}
