package com.example.starter_project_2025.system.calendar;

import com.example.starter_project_2025.system.calendar.CalendarValidateRequest.CandidateSession;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

class CalendarValidationServiceTest {

    private CalendarValidationService serviceWithDbSessions(Function<LocalDateTime, List<Session>> dbLookup) {
        SessionRepository repo = (SessionRepository) Proxy.newProxyInstance(
                SessionRepository.class.getClassLoader(),
                new Class<?>[]{SessionRepository.class},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("findOverlappingForClassOrTrainer".equals(name) || "findOverlappingAtLocation".equals(name)) {
                        return dbLookup.apply((LocalDateTime) args[0]);
                    }
                    return List.of();
                }
        );
        return new CalendarValidationService(repo);
    }

    @Test
    void validate_cleanNonOverlappingSchedule_returnsValid() {
        CalendarValidationService validationService = serviceWithDbSessions(start -> List.of());

        var request = new CalendarValidateRequest(
                1L,
                LocalDate.of(2026, 10, 1),
                List.of(
                        new CandidateSession("c1", "[JAVA_CORE] Morning", 1L, 1L, "Phòng Lab 201 (F-Town 2)",
                                LocalDateTime.of(2026, 10, 1, 8, 0), LocalDateTime.of(2026, 10, 1, 12, 0)),
                        new CandidateSession("c2", "[JAVA_CORE] Afternoon", 1L, 1L, "Phòng Lab 201 (F-Town 2)",
                                LocalDateTime.of(2026, 10, 1, 13, 0), LocalDateTime.of(2026, 10, 1, 17, 0))
                )
        );

        CalendarValidationResult result = validationService.validate(request);
        assertTrue(result.valid());
        assertTrue(result.issues().isEmpty());
    }

    @Test
    void validate_detectsBeforeLearningStartAndIntraBatchOverlaps() {
        CalendarValidationService validationService = serviceWithDbSessions(start -> List.of());

        var request = new CalendarValidateRequest(
                1L,
                LocalDate.of(2026, 10, 5),
                List.of(
                        new CandidateSession("c1", "[JAVA_CORE] Early", 1L, 1L, "Phòng Lab 201 (F-Town 2)",
                                LocalDateTime.of(2026, 10, 1, 8, 0), LocalDateTime.of(2026, 10, 1, 12, 0)),
                        new CandidateSession("c2", "[SPRING_BOOT] Overlap", 2L, 1L, "Phòng Lab 201 (F-Town 2)",
                                LocalDateTime.of(2026, 10, 1, 10, 0), LocalDateTime.of(2026, 10, 1, 13, 0))
                )
        );

        CalendarValidationResult result = validationService.validate(request);
        assertFalse(result.valid());
        assertTrue(result.issues().stream().anyMatch(i -> "BEFORE_LEARNING_START".equals(i.code())));
        assertTrue(result.issues().stream().anyMatch(i -> "TRAINER_OVERLAP".equals(i.code())));
        assertTrue(result.issues().stream().anyMatch(i -> "ROOM_OVERLAP".equals(i.code())));
        assertTrue(result.issues().stream().anyMatch(i -> "CLASS_SLOT_OVERLAP".equals(i.code())));
    }

    @Test
    void validate_ignoresSameClassDbSessionsButFlagsOtherClassConflicts() {
        Session ownOldSession = Session.builder()
                .id(10L).classId(1L).topicId(1L).trainerId(1L)
                .title("[JAVA_CORE] Old Session")
                .startTime(LocalDateTime.of(2026, 10, 1, 8, 0))
                .endTime(LocalDateTime.of(2026, 10, 1, 12, 0))
                .location("Phòng Lab 201 (F-Town 2)")
                .status(Session.SessionStatus.SCHEDULED)
                .build();

        Session otherClassConflict = Session.builder()
                .id(20L).classId(2L).topicId(2L).trainerId(1L)
                .title("[SPRING_BOOT] Class 2")
                .startTime(LocalDateTime.of(2026, 10, 2, 8, 0))
                .endTime(LocalDateTime.of(2026, 10, 2, 12, 0))
                .location("Phòng Lab 201 (F-Town 2)")
                .status(Session.SessionStatus.SCHEDULED)
                .build();

        CalendarValidationService validationService = serviceWithDbSessions(start ->
                LocalDateTime.of(2026, 10, 1, 8, 0).equals(start)
                        ? List.of(ownOldSession)
                        : List.of(otherClassConflict)
        );

        var request = new CalendarValidateRequest(
                1L,
                LocalDate.of(2026, 10, 1),
                List.of(
                        new CandidateSession("c1", "[JAVA_CORE] Replaced", 1L, 1L, "Phòng Lab 201 (F-Town 2)",
                                LocalDateTime.of(2026, 10, 1, 8, 0), LocalDateTime.of(2026, 10, 1, 12, 0)),
                        new CandidateSession("c2", "[JAVA_CORE] Conflicts With Class 2", 1L, 1L, "Phòng Lab 201 (F-Town 2)",
                                LocalDateTime.of(2026, 10, 2, 8, 0), LocalDateTime.of(2026, 10, 2, 12, 0))
                )
        );

        CalendarValidationResult result = validationService.validate(request);
        assertFalse(result.valid());
        assertEquals(2, result.issues().size());
        assertTrue(result.issues().stream().allMatch(i -> Long.valueOf(20L).equals(i.conflictingSessionId())));
    }

    @Test
    void validate_allowsConcurrentOnlineSessionsAcrossClasses() {
        CalendarValidationService validationService = serviceWithDbSessions(start -> List.of());

        var request = new CalendarValidateRequest(
                1L,
                LocalDate.of(2026, 10, 1),
                List.of(
                        new CandidateSession("c1", "[JAVA_CORE] Online", 1L, 1L, "Online MS Teams",
                                LocalDateTime.of(2026, 10, 1, 8, 0), LocalDateTime.of(2026, 10, 1, 12, 0))
                )
        );

        CalendarValidationResult result = validationService.validate(request);
        assertTrue(result.valid());
    }
}

