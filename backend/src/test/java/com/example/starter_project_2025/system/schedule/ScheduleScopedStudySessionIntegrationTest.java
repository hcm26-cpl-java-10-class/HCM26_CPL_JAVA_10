package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.system.study_session.*;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Import;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.doThrow;

/** Real JPA repositories and scoped Engine; no mock source rows or external catalogues. */
@DataJpaTest
@Import({ScheduleValidationEngine.class, ScheduleSourceRegistry.class, ScheduleScopedSettings.class,
        ScheduleRules.class, StudySessionScheduleSource.class, StudySessionScheduleSourceAdapter.class,
        DemoSessionScheduleSource.class})
class ScheduleScopedStudySessionIntegrationTest {
    @Autowired ScheduleValidationEngine engine;
    @Autowired ScheduleScopedSettings settings;
    @SpyBean StudySessionRepository sessions;
    @Autowired SubjectRepository subjects;
    @Autowired StudySessionScheduleSourceAdapter source;
    @Autowired EntityManager em;
    @MockBean ScheduleReferenceProvider references;
    private Long subjectId;
    private final LocalDate date = LocalDate.of(2026, 10, 27);

    @BeforeEach
    void setup() {
        // Explicit TEST server scope only; production defaults remain unset.
        settings.setSources(Set.of(ScheduleEntryKey.Source.STUDY_SESSION));
        subjectId = subjects.saveAndFlush(Subject.builder().code("SCOPED-JAVA").name("Scoped JPA test")
                .version("1.0").durationHours(java.math.BigDecimal.valueOf(30)).build()).getId();
    }

    @ParameterizedTest
    @CsvSource({"101,202,302,CLASS_CONFLICT", "102,201,302,TRAINER_CONFLICT", "102,202,301,ROOM_CONFLICT"})
    void readsRealStudySessionAndDetectsEachResourceOverlap(long clazz, long trainer, long room, String code) {
        var stored = save(clazz, trainer, room, 8, 10);
        em.clear();
        var result = validate(candidate(101L, 201L, 301L, 9, 11), null);
        assertEquals(Set.of(code), conflictCodes(result));
        assertEquals(ScheduleScopedValidationResult.Status.INCOMPLETE, result.status());
        assertFalse(result.isValid());
        assertTrue(result.diagnostics().stream().filter(d -> d.code().equals(code)).allMatch(d ->
                d.relatedEntryKey().equals(new ScheduleEntryKey(ScheduleEntryKey.Source.STUDY_SESSION, stored.getId()))));
        verifyNoInteractions(references); // No fabricated ACTIVE assignment or topic reference.
    }

    @Test
    void adjacentSessionsDoNotConflictAndEditExcludesOnlyItself() {
        var stored = save(101L, 201L, 301L, 8, 10);
        assertTrue(conflictCodes(validate(candidate(101L, 201L, 301L, 10, 12), null)).isEmpty());
        var key = new ScheduleEntryKey(ScheduleEntryKey.Source.STUDY_SESSION, stored.getId());
        assertTrue(conflictCodes(validate(candidate(101L, 201L, 301L, 8, 10), key)).isEmpty());
        var other = save(101L, 201L, 301L, 10, 12);
        var changed = validate(candidate(101L, 201L, 301L, 9, 11), key);
        assertEquals(Set.of("CLASS_CONFLICT", "TRAINER_CONFLICT", "ROOM_CONFLICT"), conflictCodes(changed));
        assertTrue(changed.diagnostics().stream().filter(d -> d.code().endsWith("_CONFLICT"))
                .allMatch(d -> d.relatedEntryKey().id().equals(other.getId())));
    }

    @Test
    void sameNumericIdInDemoSurvivesStudySessionEditExclusion() {
        var stored = save(101L, 201L, 301L, 8, 10);
        // Two real tables deliberately share the same numeric primary key in this test.
        em.createNativeQuery("""
                insert into sessions (id,class_id,topic_id,trainer_id,room_id,title,start_time,end_time,
                                      status,is_active,created_at,updated_at)
                values (:id,101,999,201,301,'Demo booking',:start,:end,'SCHEDULED',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
                """).setParameter("id", stored.getId()).setParameter("start", date.atTime(8, 0))
                .setParameter("end", date.atTime(10, 0)).executeUpdate();
        em.clear();
        settings.setSources(Set.of(ScheduleEntryKey.Source.STUDY_SESSION, ScheduleEntryKey.Source.DEMO_SESSION));
        var key = new ScheduleEntryKey(ScheduleEntryKey.Source.STUDY_SESSION, stored.getId());
        var result = validate(candidate(101L, 201L, 301L, 8, 10), key);
        assertEquals(Set.of("CLASS_CONFLICT", "TRAINER_CONFLICT", "ROOM_CONFLICT"), conflictCodes(result));
        assertTrue(result.diagnostics().stream().filter(d -> d.code().endsWith("_CONFLICT")).allMatch(d ->
                d.relatedEntryKey().equals(new ScheduleEntryKey(ScheduleEntryKey.Source.DEMO_SESSION, stored.getId()))));
    }

    @Test
    void legacyMissingIdsIsIncompleteAndNullsNeverCreateFalseResourceConflicts() {
        var stored = save(null, null, null, 8, 10);
        stored.setLecturer("Trainer 201");
        stored.setRoom("Room 301");
        sessions.saveAndFlush(stored);
        var result = validate(candidate(null, null, null, 9, 11), null);
        assertEquals(ScheduleScopedValidationResult.Status.INCOMPLETE, result.status());
        assertTrue(conflictCodes(result).isEmpty());
        assertTrue(result.diagnostics().stream().anyMatch(d -> d.code().equals("RESOURCE_ID_MISSING")));
        assertFalse(result.isValid());
    }

    @ParameterizedTest
    @CsvSource({"SCHEDULED,true", "CANCELLED,false", "COMPLETED,true"})
    void preservesRawStateWithoutInventingBlockingPolicy(SessionStatus status, boolean active) {
        var stored = save(101L, 201L, 301L, 8, 10);
        stored.setStatus(status);
        stored.setIsActive(active);
        sessions.saveAndFlush(stored);
        var facts = source.findPotentialEntries(date.atTime(8, 0), date.atTime(11, 0)).entries().getFirst();
        assertEquals(status.name(), facts.rawStatus());
        assertEquals(active, facts.isActive());
        assertNull(facts.facts().topicId());
        var result = validate(candidate(101L, 201L, 301L, 9, 11), null);
        assertFalse(result.isValid());
        assertTrue(result.diagnostics().stream().anyMatch(d -> d.code().equals("BLOCKING_POLICY_PENDING")));
        assertEquals(3, conflictCodes(result).size()); // Observed resource/time matches, NOT confirmed blocking eligibility.
        assertEquals(status, sessions.findById(stored.getId()).orElseThrow().getStatus());
    }

    @Test
    void configuredScopeIsExplicitAndNoDefaultSourceIsAssumed() {
        settings.setSources(Set.of());
        var result = validate(candidate(101L, 201L, 301L, 8, 10), null);
        assertFalse(result.isValid());
        assertTrue(result.diagnostics().stream().anyMatch(d -> d.code().equals("SOURCE_SCOPE_UNSPECIFIED")));
    }

    @Test
    void repositoryFailureInJpaWiringIsReportedAsIncomplete() {
        doThrow(new IllegalStateException("Simulated repository outage"))
                .when(sessions).findPotentialScheduleEntries(date, date);
        var result = validate(candidate(101L, 201L, 301L, 8, 10), null);
        assertEquals(ScheduleScopedValidationResult.Status.INCOMPLETE, result.status());
        assertFalse(result.isValid());
        assertTrue(result.diagnostics().stream().anyMatch(d -> d.code().equals("SOURCE_UNAVAILABLE")));
    }

    @Test
    void sourceLookupRejectsForeignKeyAndReportsMissingStudyRow() {
        var stored = save(101L, 201L, 301L, 8, 10);
        assertThrows(IllegalArgumentException.class, () -> source.lookup(new ScheduleEntryKey(ScheduleEntryKey.Source.DEMO_SESSION, stored.getId())));
        assertEquals(ScheduleSessionSource.LookupStatus.FOUND, source.lookup(new ScheduleEntryKey(ScheduleEntryKey.Source.STUDY_SESSION, stored.getId())).status());
        var result = validate(candidate(101L, 201L, 301L, 8, 10), new ScheduleEntryKey(ScheduleEntryKey.Source.STUDY_SESSION, Long.MAX_VALUE));
        assertTrue(result.diagnostics().stream().anyMatch(d -> d.code().equals("NOT_FOUND")));
        assertEquals(3, conflictCodes(result).size()); // Missing Edit key must not exclude the stored row.
    }

    @Test
    void candidateBatchStillUsesEngineComparisonAndReportsBothRows() {
        var candidate = candidate(101L, 201L, 301L, 8, 10);
        var result = engine.validateScoped(new ScheduleValidationBatch(List.of(
                new ScheduleValidationBatch.Item(candidate, null), new ScheduleValidationBatch.Item(candidate, null))));
        assertEquals(6, result.diagnostics().stream().filter(d -> d.code().endsWith("_CONFLICT")).count());
        assertTrue(result.diagnostics().stream().anyMatch(d -> Integer.valueOf(0).equals(d.candidateIndex()) && Integer.valueOf(1).equals(d.relatedCandidateIndex())));
        assertTrue(result.diagnostics().stream().anyMatch(d -> Integer.valueOf(1).equals(d.candidateIndex()) && Integer.valueOf(0).equals(d.relatedCandidateIndex())));
    }

    private ScheduleScopedValidationResult validate(ScheduleCandidate candidate, ScheduleEntryKey key) {
        return engine.validateScoped(new ScheduleValidationBatch(List.of(new ScheduleValidationBatch.Item(candidate, key))));
    }

    private Set<String> conflictCodes(ScheduleScopedValidationResult result) {
        return result.diagnostics().stream().map(ScheduleScopedValidationResult.Diagnostic::code)
                .filter(code -> code.endsWith("_CONFLICT")).collect(Collectors.toSet());
    }

    private ScheduleCandidate candidate(Long clazz, Long trainer, Long room, int start, int end) {
        return new ScheduleCandidate(null, clazz, null, trainer, null, room, null, null, "Scoped proposal",
                date.atTime(start, 0), date.atTime(end, 0));
    }

    private StudySession save(Long clazz, Long trainer, Long room, int start, int end) {
        return sessions.saveAndFlush(StudySession.builder().subjectId(subjectId).classId(clazz).trainerId(trainer).roomId(room)
                .title("Persisted StudySession").sessionDate(date).startTime(LocalTime.of(start, 0)).endTime(LocalTime.of(end, 0))
                .lecturer("Legacy name").type(StudySessionType.LECTURE).build());
    }
}
