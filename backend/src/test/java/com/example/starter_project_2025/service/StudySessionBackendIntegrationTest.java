package com.example.starter_project_2025.service;

import com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder;
import com.example.starter_project_2025.base.dataio.exporter.service.ExportService;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationGraphBuilder;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationLookupEngine;
import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateService;
import com.example.starter_project_2025.system.study_session.*;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

/** Real shared Subject/JPA repositories and real module beans; no external API calls. */
@DataJpaTest
@Import({StudySessionServiceImpl.class, StudySessionMapperImpl.class, StudySessionValidator.class,
        StudySessionAssignmentResolver.class,
        MockStudySessionVersionLock.class, StudySessionController.class, StudySessionImportService.class,
        AutoSpecBuilder.class, StudySessionBackendIntegrationTest.ValidationConfig.class})
class StudySessionBackendIntegrationTest {
    @TestConfiguration
    @EnableMethodSecurity
    static class ValidationConfig {
        @Bean
        LocalValidatorFactoryBean validator() { return new LocalValidatorFactoryBean(); }
    }

    @MockBean ExportService exports;
    @MockBean ParserFactory fallbackParsers;
    @MockBean RelationLookupEngine relations;
    @MockBean RelationGraphBuilder graph;
    @MockBean com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentRepository assignments;
    @MockBean com.example.starter_project_2025.system.trainingprogram.ClassSetupService classSetup;
    @Autowired StudySessionService service;
    @Autowired StudySessionController controller;
    @Autowired StudySessionRepository sessions;
    @Autowired SubjectRepository subjects;
    @Autowired jakarta.persistence.EntityManager entityManager;

    @AfterEach
    void clearSecurity() { SecurityContextHolder.clearContext(); }

    @Test
    void sharedSubjectMappingCrudAndLifecycleWorkWithRealSpringBeans() {
        authenticate("STUDY_SESSION_CREATE", "STUDY_SESSION_READ", "STUDY_SESSION_UPDATE", "STUDY_SESSION_DELETE");
        Subject subject = subject();
        var created = service.create(request(subject.getId()));
        assertEquals("Java integration", created.getSubjectName());
        assertEquals(SessionStatus.SCHEDULED, created.getStatus());
        var changes = new StudySessionDTO();
        changes.setTitle("Updated Java lesson");
        assertEquals("Updated Java lesson", service.update(created.getId(), changes).getTitle());
        assertEquals(LocalTime.of(8, 0), service.getById(created.getId()).getStartTime());
        assertEquals(SessionStatus.COMPLETED, service.complete(created.getId(), null).getStatus());

        // Duplicate is a frontend new-create flow: the same business fields create a fresh identity.
        var duplicate = service.create(request(subject.getId()));
        assertNotEquals(created.getId(), duplicate.getId());
        assertEquals(SessionStatus.SCHEDULED, duplicate.getStatus());
        var reason = new CancelSessionRequest();
        reason.setReason("Class unavailable");
        assertEquals(SessionStatus.CANCELLED, service.cancel(duplicate.getId(), reason).getStatus());
        assertEquals(StudySessionStatistics.of(0, 1, 1), service.statistics(subject.getId(), null, null));
        service.delete(duplicate.getId());
        assertFalse(sessions.existsById(duplicate.getId()));
    }

    @Test
    void excelImportUsesLocalConvertersAndChecksCreatePermission() throws Exception {
        Long subjectId = subject().getId();
        byte[] template = new ImportTemplateService().generateTemplate(StudySession.class);
        byte[] content;
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(template));
             var output = new ByteArrayOutputStream()) {
            var sheet = workbook.getSheetAt(0);
            var row = sheet.createRow(1);
            for (var header : sheet.getRow(0)) {
                var cell = row.createCell(header.getColumnIndex());
                switch (header.getStringCellValue()) {
                    case "Subject ID" -> cell.setCellValue(subjectId.doubleValue());
                    case "Title" -> cell.setCellValue("Excel integration lesson");
                    case "Session Date" -> cell.setCellValue("2026-10-19");
                    case "Start Time" -> cell.setCellValue("08:00");
                    case "End Time" -> cell.setCellValue("09:00");
                    case "Lecturer" -> cell.setCellValue("Nguyen Van An");
                    case "Type" -> cell.setCellValue("LECTURE");
                    default -> cell.setCellValue("");
                }
            }
            workbook.write(output);
            content = output.toByteArray();
        }
        var file = new MockMultipartFile("file", "sessions.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content);
        authenticate("STUDY_SESSION_READ");
        assertThrows(AccessDeniedException.class, () -> controller.importFile(file));
        assertEquals(0, sessions.count());
        authenticate("STUDY_SESSION_CREATE");
        var imported = controller.importFile(file);
        assertEquals(1, imported.getSuccessCount());
        assertEquals(0, imported.getFailureCount());
        var saved = sessions.findAll().getFirst();
        assertEquals(subjectId, saved.getSubjectId());
        assertEquals(LocalTime.of(8, 0), saved.getStartTime());
        assertEquals(SessionStatus.SCHEDULED, saved.getStatus());
        assertNull(saved.getClassId());
        assertNull(saved.getTeachingAssignmentId());
        assertNull(saved.getProgramSubjectId());
        assertNull(saved.getTrainerId());
        assertNull(saved.getRoomId());
        assertNull(saved.getMeetingUrl());
    }

    @Test
    void scalarLinksPersistAndSurvivePartialServiceUpdates() {
        authenticate("STUDY_SESSION_CREATE", "STUDY_SESSION_READ", "STUDY_SESSION_UPDATE");
        var dto = request(subject().getId());
        // Arbitrary positive scalar values exercise storage only, not assignment resolution.
        dto.setClassId(11L);
        dto.setTeachingAssignmentId(12L);
        dto.setProgramSubjectId(13L);
        dto.setTrainerId(14L);
        dto.setRoomId(15L);
        dto.setMeetingUrl("https://example.com/lesson");
        var program = new com.example.starter_project_2025.system.trainingprogram.TrainingProgram();
        program.setId(17L);
        var programSubject = new com.example.starter_project_2025.system.trainingprogram.ProgramSubject();
        programSubject.setId(13L);
        programSubject.setProgram(program);
        programSubject.setSubject(subjects.findById(dto.getSubjectId()).orElseThrow());
        var assignment = new com.example.starter_project_2025.system.trainingprogram.TeachingAssignment();
        assignment.setId(12L);
        assignment.setClassId(11L);
        assignment.setTrainerId(14L);
        assignment.setProgramSubject(programSubject);
        assignment.setEffectiveFrom(dto.getSessionDate());
        org.mockito.Mockito.when(assignments.findById(12L)).thenReturn(java.util.Optional.of(assignment));
        org.mockito.Mockito.when(classSetup.getClassProgramSubjects(11L)).thenReturn(
                new com.example.starter_project_2025.system.trainingprogram.ClassProgramSubjectsResponse(
                        11L, null, null,
                        new com.example.starter_project_2025.system.trainingprogram.ClassProgramSubjectsResponse.ProgramSummary(
                                17L, null, null, null, null), java.util.List.of()));
        var created = service.create(dto);
        sessions.flush();
        entityManager.clear();
        var changes = new StudySessionDTO();
        changes.setTitle("Updated scalar links lesson");
        var updated = service.update(created.getId(), changes);
        assertEquals(11L, updated.getClassId());
        assertEquals(12L, updated.getTeachingAssignmentId());
        assertEquals(13L, updated.getProgramSubjectId());
        assertEquals(14L, updated.getTrainerId());
        assertEquals(15L, updated.getRoomId());
        assertEquals(dto.getMeetingUrl(), updated.getMeetingUrl());
        changes.setRoomId(16L);
        changes.setMeetingUrl("https://example.com/new-lesson");
        service.update(created.getId(), changes);
        sessions.flush();
        entityManager.clear();
        var saved = service.getById(created.getId());
        assertEquals(16L, saved.getRoomId());
        assertEquals(changes.getMeetingUrl(), saved.getMeetingUrl());
        assertEquals(dto.getSubjectId(), saved.getSubjectId());
        assertEquals("Java integration", saved.getSubjectName());
        changes.setTrainerId(0L);
        assertThrows(com.example.starter_project_2025.exception.BusinessValidationException.class,
                () -> service.update(created.getId(), changes));
        changes.setTrainerId(null);
        changes.setSessionDate(dto.getSessionDate().minusDays(1));
        assertThrows(com.example.starter_project_2025.exception.BusinessValidationException.class,
                () -> service.update(created.getId(), changes));
        assertEquals(dto.getSessionDate(), service.getById(created.getId()).getSessionDate());
        var invalidCreate = request(dto.getSubjectId());
        invalidCreate.setTeachingAssignmentId(12L);
        invalidCreate.setClassId(99L);
        long count = sessions.count();
        assertThrows(com.example.starter_project_2025.exception.BusinessValidationException.class,
                () -> service.create(invalidCreate));
        assertEquals(count, sessions.count());
        var linkedCreate = request(dto.getSubjectId());
        linkedCreate.setClassId(11L);
        linkedCreate.setTeachingAssignmentId(12L);
        var linked = service.create(linkedCreate);
        assertEquals(13L, linked.getProgramSubjectId());
        assertEquals(14L, linked.getTrainerId());
        // Lifecycle transitions must not revalidate a subsequently changed/expired assignment.
        assignment.setEffectiveTo(dto.getSessionDate().minusDays(1));
        assertEquals(SessionStatus.COMPLETED, service.complete(created.getId(), null).getStatus());
        var cancellation = new CancelSessionRequest();
        cancellation.setReason("Class unavailable");
        assertEquals(SessionStatus.CANCELLED, service.cancel(linked.getId(), cancellation).getStatus());
    }

    private Subject subject() {
        return subjects.saveAndFlush(Subject.builder().code("SS-JAVA").name("Java integration")
                .version("1.0").durationHours(30).build());
    }

    private StudySessionDTO request(Long subjectId) {
        var request = StudySessionDTO.builder().subjectId(subjectId).title("Java integration lesson")
                .sessionDate(LocalDate.of(2026, 10, 19)).startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(9, 0)).lecturer("Nguyen Van An").type(StudySessionType.LECTURE).build();
        request.setIsActive(true);
        return request;
    }

    private void authenticate(String... permissions) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "study-session-test", "", Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
    }
}
