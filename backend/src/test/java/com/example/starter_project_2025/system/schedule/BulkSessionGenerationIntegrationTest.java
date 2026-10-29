package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.demo.session.*;
import com.example.starter_project_2025.system.schedule.generation.*;
import com.example.starter_project_2025.system.schedule.generation.dto.*;
import com.example.starter_project_2025.system.schedule.generation.engine.ScheduleGeneratorEngine;
import com.example.starter_project_2025.system.trainingprogram.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(properties = {"spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false"})
@ContextConfiguration(classes = BulkSessionGenerationIntegrationTest.Config.class)
@ActiveProfiles("schedule-demo")
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class BulkSessionGenerationIntegrationTest {
    @TestConfiguration
    @EnableMethodSecurity
    @EntityScan(basePackageClasses = {Session.class, ScheduleWriteLock.class})
    @EnableJpaRepositories(basePackageClasses = {SessionRepository.class, ScheduleWriteLockRepository.class})
    @Import({ScheduleValidationEngine.class, ScheduleRules.class, DemoScheduleReferenceProvider.class,
            SessionServiceImpl.class, SessionMapperImpl.class, ScheduleGeneratorEngine.class, BulkSessionGenerationServiceImpl.class})
    static class Config {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper().findAndRegisterModules(); }
    }
    @MockBean AutoSpecBuilder autoSpecBuilder;
    @MockBean TeachingAssignmentSessionGuard assignmentGuard;
    @MockBean ClassSetupService classSetup;
    @Autowired SessionRepository sessions;
    @Autowired ScheduleWriteLockRepository locks;
    @Autowired BulkSessionGenerationService service;
    @Autowired PlatformTransactionManager transactions;
    String key;

    @BeforeEach void setup() {
        sessions.deleteAll(); locks.saveAndFlush(new ScheduleWriteLock(1L));
        key = UUID.randomUUID().toString(); authenticate("SESSION_READ", "SESSION_CREATE");
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    private void authenticate(String... permissions) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("scheduler", "",
                Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
    }
    private PreviewSessionItemDTO item(String start, String end) {
        return PreviewSessionItemDTO.builder().tempId("preview-row").topicId(1L).trainerId(1L)
                .teachingAssignmentId(1L).roomId(1L).title("Java").sessionNumber(1)
                .startTime(LocalDateTime.parse("2026-10-21T" + start))
                .endTime(LocalDateTime.parse("2026-10-21T" + end)).build();
    }
    private BulkSaveSessionsRequestDTO request(PreviewSessionItemDTO... items) {
        return BulkSaveSessionsRequestDTO.builder().sessions(List.of(items)).build();
    }
    @Test void savesAdjacentSessionsDirectlyWithoutADraftVersion() {
        var result = service.saveBulkSessions(1L, request(item("09:00", "10:00"), item("10:00", "11:00")), key);
        assertEquals(2, result.getCreatedCount()); assertEquals(2, sessions.count());
        assertTrue(sessions.findAll().stream().allMatch(s -> s.getStatus() == Session.SessionStatus.SCHEDULED));
    }
    @Test void editedPreviewCannotSaveOverlappingRowsAndLeavesNoPartialData() {
        assertThrows(ScheduleValidationException.class, () -> service.saveBulkSessions(1L,
                request(item("09:00", "10:00"), item("09:30", "10:30")), key));
        assertEquals(0, sessions.count());
    }
    @Test void saveRechecksConflictsAddedSincePreview() {
        service.saveBulkSessions(1L, request(item("09:00", "10:00")), key);
        assertThrows(ScheduleValidationException.class, () -> service.saveBulkSessions(1L,
                request(item("09:30", "10:30")), UUID.randomUUID().toString()));
        assertEquals(1, sessions.count());
    }
    @Test void aLostResponseCanBeRetriedWithoutDuplicateRows() {
        var body = request(item("09:00", "10:00"));
        var first = service.saveBulkSessions(1L, body, key);
        var retry = service.saveBulkSessions(1L, body, key);
        assertEquals(first.getCorrelationId(), retry.getCorrelationId()); assertEquals(1, sessions.count());
    }
    @Test void changedDataCannotReuseTheSameRequestKey() {
        service.saveBulkSessions(1L, request(item("09:00", "10:00")), key);
        assertThrows(ConflictException.class, () -> service.saveBulkSessions(1L, request(item("10:00", "11:00")), key));
        assertEquals(1, sessions.count());
    }
    @Test void aRolledBackTransactionDoesNotCacheSuccess() {
        var tx = new TransactionTemplate(transactions);
        var body = request(item("09:00", "10:00"));
        assertThrows(IllegalStateException.class, () -> tx.execute(status -> {
            service.saveBulkSessions(1L, body, key); throw new IllegalStateException("Rollback the caller");
        }));
        assertEquals(0, sessions.count());
        assertEquals(1, service.saveBulkSessions(1L, body, key).getCreatedCount()); assertEquals(1, sessions.count());
    }
    @Test void cachedResponsesStillRequireCreatePermission() {
        var body = request(item("09:00", "10:00")); service.saveBulkSessions(1L, body, key);
        authenticate("SESSION_READ");
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> service.saveBulkSessions(1L, body, key));
    }
    @Test void missingAssignmentDoesNotTurnIntoTrainerOne() {
        var row = item("09:00", "10:00"); row.setTeachingAssignmentId(null);
        assertThrows(BadRequestException.class, () -> service.saveBulkSessions(1L, request(row), key));
        assertEquals(0, sessions.count());
    }
    @Test void contextPreservesSubjectAndProgramSubjectAsDifferentIdentities() {
        when(classSetup.getClassProgramSubjects(1L)).thenReturn(new ClassProgramSubjectsResponse(1L, "JAVA-01", "Java",
                new ClassProgramSubjectsResponse.ProgramSummary(2L, "JAVA", "Program", "1", ProgramStatus.ACTIVE),
                List.of(new ClassProgramSubjectsResponse.ProgramSubjectItem(99L, 1L, "JAVA", "Java", java.math.BigDecimal.valueOf(4), 1, List.of()))));
        var topic = service.getGenerationContext(1L).getTopics().getFirst();
        assertEquals(1L, topic.getTopicId()); assertEquals(99L, topic.getProgramSubjectId()); assertNull(topic.getAssignedTrainerId());
    }
    @Test void missingClassProgramDoesNotReturnSampleSubjects() {
        when(classSetup.getClassProgramSubjects(1L)).thenReturn(new ClassProgramSubjectsResponse(1L, "JAVA-01", "Java", null, List.of()));
        assertThrows(BadRequestException.class, () -> service.getGenerationContext(1L));
    }
}
