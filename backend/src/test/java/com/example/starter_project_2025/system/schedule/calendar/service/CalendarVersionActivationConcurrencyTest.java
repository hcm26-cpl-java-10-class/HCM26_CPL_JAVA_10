package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionMapperImpl;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarVersionResponse;
import com.example.starter_project_2025.system.schedule.calendar.exception.CalendarActivationConflictException;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.conflict_resolution.ConflictResolutionServiceImpl;
import com.example.starter_project_2025.system.schedule.detection.ConflictDetectionMapperImpl;
import com.example.starter_project_2025.system.schedule.detection.ConflictDetectionServiceImpl;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionMapperImpl;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

@DataJpaTest
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Import({
        CalendarVersionServiceImpl.class,
        ConflictDetectionServiceImpl.class,
        ConflictResolutionServiceImpl.class,
        CalendarVersionMapperImpl.class,
        ConflictDetectionMapperImpl.class,
        SessionMapperImpl.class,
        CalendarVersionActivationConcurrencyTest.FixedClockConfig.class
})
class CalendarVersionActivationConcurrencyTest {

    @Autowired
    private CalendarVersionService calendarVersionService;

    @Autowired
    private CalendarRepository calendarRepository;

    @Autowired
    private CalendarVersionRepository calendarVersionRepository;

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void shouldAllowOnlyOneOfTwoConflictingDraftsToActivateConcurrently() throws Exception {
        List<DraftRef> drafts = new TransactionTemplate(transactionManager).execute(status -> List.of(
                createDraft(82001L),
                createDraft(82002L)
        ));

        DraftRef firstDraft = drafts.get(0);
        DraftRef secondDraft = drafts.get(1);

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<Object> first = executor.submit(() -> activateAfterBarrier(
                    ready,
                    start,
                    firstDraft.calendarId(),
                    firstDraft.versionId(),
                    71L
            ));
            Future<Object> second = executor.submit(() -> activateAfterBarrier(
                    ready,
                    start,
                    secondDraft.calendarId(),
                    secondDraft.versionId(),
                    72L
            ));

            ready.await(5, TimeUnit.SECONDS);
            start.countDown();

            List<Object> outcomes = List.of(
                    first.get(10, TimeUnit.SECONDS),
                    second.get(10, TimeUnit.SECONDS)
            );

            long successCount = outcomes.stream()
                    .filter(CalendarVersionResponse.class::isInstance)
                    .count();
            long conflictCount = outcomes.stream()
                    .filter(CalendarActivationConflictException.class::isInstance)
                    .count();

            assertEquals(1, successCount);
            assertEquals(1, conflictCount);
            outcomes.stream()
                    .filter(CalendarActivationConflictException.class::isInstance)
                    .findFirst()
                    .ifPresent(outcome -> assertInstanceOf(
                            CalendarActivationConflictException.class,
                            outcome
                    ));

            long activeCount = List.of(firstDraft.versionId(), secondDraft.versionId()).stream()
                    .map(id -> calendarVersionRepository.findById(id).orElseThrow())
                    .filter(version -> version.getStatus() == CalendarVersionStatus.ACTIVE)
                    .count();
            assertEquals(1, activeCount);
        } finally {
            executor.shutdownNow();
        }
    }

    private Object activateAfterBarrier(
            CountDownLatch ready,
            CountDownLatch start,
            Long calendarId,
            Long versionId,
            Long actorId
    ) throws InterruptedException {
        ready.countDown();
        start.await(5, TimeUnit.SECONDS);
        try {
            return calendarVersionService.activateVersion(calendarId, versionId, actorId);
        } catch (CalendarActivationConflictException exception) {
            return exception;
        }
    }

    private DraftRef createDraft(Long classId) {
        Calendar calendar = calendarRepository.save(Calendar.builder()
                .classId(classId)
                .name("Calendar " + classId)
                .lastIssuedVersionNumber(1)
                .isActive(true)
                .build());
        CalendarVersion draft = calendarVersionRepository.save(CalendarVersion.builder()
                .calendar(calendar)
                .versionNumber(1)
                .status(CalendarVersionStatus.DRAFT)
                .name("Draft")
                .isActive(true)
                .build());
        sessionRepository.save(Session.builder()
                .calendarVersion(draft)
                .classCode("CLASS-" + classId)
                .trainerId(101L)
                .trainerName("Trainer T01")
                .title("Concurrent activation session")
                .startTime(LocalDateTime.of(2026, 10, 21, 9, 0))
                .endTime(LocalDateTime.of(2026, 10, 21, 11, 0))
                .room("R01")
                .status(SessionStatus.SCHEDULED)
                .isActive(true)
                .build());
        return new DraftRef(calendar.getId(), draft.getId());
    }

    private record DraftRef(Long calendarId, Long versionId) {
    }

    @TestConfiguration
    static class FixedClockConfig {

        @Bean
        Clock clock() {
            return Clock.fixed(
                    Instant.parse("2026-10-20T07:30:00Z"),
                    ZoneOffset.UTC
            );
        }
    }
}
