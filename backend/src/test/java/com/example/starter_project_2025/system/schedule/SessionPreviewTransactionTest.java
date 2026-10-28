package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder;
import com.example.starter_project_2025.base.dataio.importer.mapper.ValueConverter;
import com.example.starter_project_2025.base.dataio.importer.parser.*;
import com.example.starter_project_2025.system.demo.session.*;
import com.example.starter_project_2025.system.trainingprogram.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.*;
import org.springframework.transaction.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** A real proxied guard and real transaction are required to reproduce rollback-only. */
@DataJpaTest(properties = {"spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false"})
@ContextConfiguration(classes = SessionPreviewTransactionTest.Config.class)
@ActiveProfiles("schedule-demo")
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class SessionPreviewTransactionTest {
    @TestConfiguration
    @EntityScan(basePackageClasses = {Session.class, ScheduleWriteLock.class})
    @EnableJpaRepositories(basePackageClasses = {SessionRepository.class, ScheduleWriteLockRepository.class})
    @Import({ScheduleValidationEngine.class, ScheduleRules.class, DemoScheduleReferenceProvider.class,
            SessionServiceImpl.class, SessionMapperImpl.class, TeachingAssignmentSessionGuard.class,
            SessionImportService.class, SessionImportCoordinator.class, ParserFactory.class, ExcelParser.class, CsvParser.class, ValueConverter.class})
    static class Config {}

    @MockBean AutoSpecBuilder autoSpecBuilder;
    @MockBean TeachingAssignmentRepository assignments;
    @MockBean SessionImportAssignmentPolicy importAssignments;
    @Autowired SessionService service;
    @Autowired SessionImportService imports;
    @Autowired SessionRepository sessions;

    @BeforeEach void authenticate() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("scheduler", "",
                List.of(new SimpleGrantedAuthority("SESSION_READ"),new SimpleGrantedAuthority("SESSION_CREATE"))));
        when(assignments.findById(anyLong())).thenReturn(Optional.empty());
        when(importAssignments.validateAndResolve(anyList())).thenReturn(List.of());
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test void missingAssignmentReturnsRowIssuesInsteadOfUnexpectedRollback() {
        var request = request(1L,1L,1L,1L);
        var result = assertDoesNotThrow(() -> service.previewValidatedBatch(List.of(request)));
        assertFalse(result.valid());
        assertTrue(result.issues().stream().anyMatch(issue -> issue.message().contains("no longer exists")));
        assertEquals(0,sessions.count());
    }

    @Test void mismatchingAndExpiredAssignmentsDoNotPoisonThePreviewTransaction() {
        var wrongClass = assignment(2L,1L);
        var wrongTrainer = assignment(1L,2L);
        var expired = assignment(1L,1L); expired.setEffectiveTo(LocalDate.of(2026,1,2));
        for (var assignment : List.of(wrongClass,wrongTrainer,expired)) {
            when(assignments.findById(1L)).thenReturn(Optional.of(assignment));
            var result = assertDoesNotThrow(() -> service.previewValidatedBatch(List.of(request(1L,1L,1L,1L))));
            assertFalse(result.valid());
            assertTrue(result.issues().stream().anyMatch(issue -> issue.code().equals("ASSIGNMENT_INVALID")));
            assertFalse(assignment.getEverUsed());
        }
    }

    @Test void anInvalidRowDoesNotStopValidationOfOtherRowsOrWriteUsageMarkers() {
        var valid = assignment(2L,2L); valid.setId(2L);
        when(assignments.findById(2L)).thenReturn(Optional.of(valid));
        var result = assertDoesNotThrow(() -> service.previewValidatedBatch(List.of(request(1L,1L,1L,1L),request(2L,2L,2L,2L))));
        assertFalse(result.valid());
        assertEquals(1,result.issues().size());
        assertEquals(0,result.issues().getFirst().candidateIndex());
        assertFalse(valid.getEverUsed());
        assertEquals(0,sessions.count());
    }

    @Test void filePreviewAndConfirmationBothReturnReadableErrorsWithoutPartialWrites() {
        var csv = "Class ID,Topic ID,Trainer ID,Teaching Assignment ID,Room ID,Session Title,Start Time,End Time\n"
                + "1,1,1,1,1,Transaction regression,2026-10-28T09:00,2026-10-28T10:00\n";
        var file = new MockMultipartFile("file","sessions.csv","text/csv",csv.getBytes(StandardCharsets.UTF_8));
        var preview = assertDoesNotThrow(() -> imports.preview(file));
        assertFalse(preview.canImport());
        assertTrue(preview.rows().getFirst().errors().stream().anyMatch(message -> message.contains("no longer exists")));
        var result = assertDoesNotThrow(() -> imports.importFile(file));
        assertEquals(0,result.getSuccessCount()); assertEquals(1,result.getFailureCount());
        assertEquals(0,sessions.count());
    }

    private SessionDTO request(Long classId,Long trainerId,Long assignmentId,Long roomId) {
        return SessionDTO.builder().classId(classId).topicId(1L).trainerId(trainerId).teachingAssignmentId(assignmentId)
                .roomId(roomId).title("Transaction regression").startTime(LocalDateTime.of(2026,10,28,9,0))
                .endTime(LocalDateTime.of(2026,10,28,10,0)).build();
    }
    private TeachingAssignment assignment(Long classId,Long trainerId) {
        var assignment = new TeachingAssignment(); assignment.setId(1L); assignment.setClassId(classId);
        assignment.setTrainerId(trainerId); assignment.setIsActive(true); assignment.setEverUsed(false);
        assignment.setEffectiveFrom(LocalDate.of(2026,1,1)); return assignment;
    }
}