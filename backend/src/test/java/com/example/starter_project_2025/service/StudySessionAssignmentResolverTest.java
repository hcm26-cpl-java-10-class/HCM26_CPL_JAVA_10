package com.example.starter_project_2025.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationGraphBuilder;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationLookupEngine;
import com.example.starter_project_2025.system.study_session.*;
import com.example.starter_project_2025.system.study_session.dataio.StudySessionValueConverter;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.trainingprogram.*;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudySessionAssignmentResolverTest {
    private static final ValidatorFactory FACTORY = Validation.buildDefaultValidatorFactory();
    private final TeachingAssignmentRepository assignments = mock(TeachingAssignmentRepository.class);
    private final ClassSetupService classSetup = mock(ClassSetupService.class);
    private final StudySessionAssignmentResolver resolver = new StudySessionAssignmentResolver(assignments, classSetup);
    private TeachingAssignment assignment;

    @AfterAll
    static void closeFactory() { FACTORY.close(); }

    @BeforeEach
    void setup() {
        var subject = new Subject();
        subject.setId(3L);
        var program = new TrainingProgram();
        program.setId(7L);
        var ps = new ProgramSubject();
        ps.setId(4L);
        ps.setSubject(subject);
        ps.setProgram(program);
        assignment = new TeachingAssignment();
        assignment.setId(1L);
        assignment.setClassId(2L);
        assignment.setProgramSubject(ps);
        assignment.setTrainerId(5L);
        assignment.setEffectiveFrom(LocalDate.of(2026, 10, 1));
        assignment.setEffectiveTo(LocalDate.of(2026, 10, 31));
        when(assignments.findById(1L)).thenReturn(Optional.of(assignment));
        when(classSetup.getClassProgramSubjects(2L)).thenReturn(classProgram(7L));
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-10-01", "2026-10-31"})
    void acceptsInclusiveBoundaryAndDerivesOnlyOfficialIds(String date) {
        var request = request();
        request.setSessionDate(LocalDate.parse(date));
        var ctx = new ValidationContext();
        var resolved = resolver.resolve(request, ctx);
        assertFalse(ctx.hasErrors(), ctx.getErrors().toString());
        assertEquals(new StudySessionAssignmentResolver.ResolvedAssignment(4L, 5L), resolved);
        assertNull(request.getTrainerId());
        assertNull(request.getProgramSubjectId());
    }

    @Test
    void acceptsExplicitMatchingIdsAndOpenEndedAssignment() {
        assignment.setEffectiveTo(null);
        var request = request();
        request.setSessionDate(LocalDate.of(2030, 1, 1));
        request.setProgramSubjectId(4L);
        request.setTrainerId(5L);
        var ctx = new ValidationContext();
        assertNotNull(resolver.resolve(request, ctx));
        assertFalse(ctx.hasErrors());
    }

    @Test
    void missingAssignmentAndMissingClassAreRejected() {
        var request = request();
        request.setTeachingAssignmentId(999L);
        assertInvalid(request, "teachingAssignmentId");
        request.setTeachingAssignmentId(1L);
        request.setClassId(null);
        assertInvalid(request, "classId");
    }

    @ParameterizedTest
    @ValueSource(strings = {"classId", "subjectId", "programSubjectId", "trainerId"})
    void rejectsEachContradictoryIdWithoutChangingRequest(String field) throws Exception {
        var request = request();
        var setter = StudySessionDTO.class.getMethod("set" + Character.toUpperCase(field.charAt(0)) + field.substring(1), Long.class);
        setter.invoke(request, 99L);
        assertInvalid(request, field);
        assertEquals(99L, StudySessionDTO.class.getMethod("get" + Character.toUpperCase(field.charAt(0)) + field.substring(1)).invoke(request));
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-09-30", "2026-11-01"})
    void rejectsDatesOutsideAssignment(String date) {
        var request = request();
        request.setSessionDate(LocalDate.parse(date));
        assertInvalid(request, "sessionDate");
    }

    @Test
    void rejectsWrongOrMissingClassProgramAndPropagatesLookupFailure() {
        when(classSetup.getClassProgramSubjects(2L)).thenReturn(classProgram(8L));
        assertInvalid(request(), "programSubjectId");
        when(classSetup.getClassProgramSubjects(2L)).thenReturn(new ClassProgramSubjectsResponse(2L, null, null, null, List.of()));
        assertInvalid(request(), "programSubjectId");
        when(classSetup.getClassProgramSubjects(2L)).thenThrow(new IllegalStateException("Source unavailable"));
        assertThrows(IllegalStateException.class, () -> resolver.resolve(request(), new ValidationContext()));
    }

    @Test
    void editValidatesMergedDateSubjectAndStoredIdsWithoutMutatingEntity() {
        var entity = new StudySession();
        entity.setTeachingAssignmentId(1L);
        entity.setClassId(2L);
        entity.setSubjectId(3L);
        entity.setProgramSubjectId(4L);
        entity.setTrainerId(5L);
        entity.setSessionDate(LocalDate.of(2026, 10, 15));
        var changes = new StudySessionDTO();
        changes.setSessionDate(LocalDate.of(2026, 11, 1));
        var ctx = new ValidationContext();
        assertNull(resolver.resolveUpdate(entity, changes, ctx));
        assertTrue(ctx.getErrors().containsKey("sessionDate"));
        assertEquals(LocalDate.of(2026, 10, 15), entity.getSessionDate());
        changes.setSessionDate(LocalDate.of(2026, 10, 31));
        assertNotNull(resolver.resolveUpdate(entity, changes, new ValidationContext()));
        changes.setSubjectId(99L);
        ctx = new ValidationContext();
        assertNull(resolver.resolveUpdate(entity, changes, ctx));
        assertTrue(ctx.getErrors().containsKey("subjectId"));
        changes.setSubjectId(3L);
        changes.setTeachingAssignmentId(10L);
        var other = new TeachingAssignment();
        other.setId(10L);
        other.setClassId(2L);
        other.setProgramSubject(assignment.getProgramSubject());
        other.setTrainerId(6L);
        other.setEffectiveFrom(assignment.getEffectiveFrom());
        when(assignments.findById(10L)).thenReturn(Optional.of(other));
        ctx = new ValidationContext();
        assertNull(resolver.resolveUpdate(entity, changes, ctx));
        assertTrue(ctx.getErrors().containsKey("trainerId"));
    }

    @Test
    void legacyWithoutAssignmentSkipsLookupsAndDoesNotInventIds() {
        var request = request();
        request.setTeachingAssignmentId(null);
        assertNull(resolver.resolve(request, new ValidationContext()));
        verifyNoInteractions(assignments, classSetup);
        assertNull(request.getTeachingAssignmentId());
    }

    @Test
    void incompleteAssignmentFailsClosed() {
        assignment.setProgramSubject(null);
        assertInvalid(request(), "teachingAssignmentId");
    }

    @Test
    void activeEligibilityIsExplicitlyPendingRatherThanInferredFromFlag() {
        assignment.setIsActive(false);
        var ctx = new ValidationContext();
        assertNotNull(resolver.resolve(request(), ctx)); // Link/date resolution only, not business eligibility.
        assertFalse(ctx.hasErrors());
    }

    @Test
    void excelUsesSameResolverPreservesRowErrorsAndDoesNotSaveInvalidLinks() throws Exception {
        var sessions = mock(StudySessionRepository.class);
        var subjects = mock(SubjectRepository.class);
        when(subjects.existsById(3L)).thenReturn(true);
        var mapper = new GenericImportMapper(mock(RelationLookupEngine.class), mock(RelationGraphBuilder.class), new StudySessionValueConverter());
        var importer = new StudySessionImportService(mock(ParserFactory.class), mapper);
        var controller = new StudySessionController(null, sessions, importer, subjects,
                new StudySessionValidator(FACTORY.getValidator()), resolver);
        byte[] bytes;
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet();
            var headers = List.of("Subject ID", "Title", "Session Date", "Start Time", "End Time", "Lecturer", "Type",
                    "Class ID", "Teaching Assignment ID", "Program Subject ID", "Trainer ID");
            var header = sheet.createRow(0);
            for (int col = 0; col < headers.size(); col++) header.createCell(col).setCellValue(headers.get(col));
            for (int index = 1; index <= 6; index++) {
                var row = sheet.createRow(index);
                var values = new String[]{"3", "Imported lesson", "2026-10-15", "08:00", "09:00", "Nguyen Van An", "LECTURE",
                        "2", "1", "", ""};
                if (index == 2) { values[7] = ""; values[8] = ""; } // legacy row
                if (index == 3) values[7] = "99";
                if (index == 4) values[10] = "99";
                if (index == 5) values[2] = "2026-11-01";
                if (index == 6) values[8] = "999";
                for (int col = 0; col < values.length; col++) row.createCell(col).setCellValue(values[col]);
            }
            workbook.write(output);
            bytes = output.toByteArray();
        }
        var result = controller.importFile(new MockMultipartFile("file", "links.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes));
        assertEquals(2, result.getSuccessCount());
        assertEquals(4, result.getFailureCount());
        var saved = org.mockito.ArgumentCaptor.forClass(StudySession.class);
        verify(sessions, times(2)).save(saved.capture());
        assertEquals(4L, saved.getAllValues().get(0).getProgramSubjectId());
        assertEquals(5L, saved.getAllValues().get(0).getTrainerId());
        assertNull(saved.getAllValues().get(1).getTeachingAssignmentId());
        assertNull(saved.getAllValues().get(1).getProgramSubjectId());
        assertEquals(List.of(4, 5, 6, 7), result.getErrors().stream().map(error -> error.getRowNumber()).toList());
    }

    private ClassProgramSubjectsResponse classProgram(Long id) {
        return new ClassProgramSubjectsResponse(2L, null, null,
                new ClassProgramSubjectsResponse.ProgramSummary(id, null, null, null, null), List.of());
    }

    private StudySessionDTO request() {
        return StudySessionDTO.builder().teachingAssignmentId(1L).classId(2L).subjectId(3L)
                .sessionDate(LocalDate.of(2026, 10, 15)).build();
    }

    private void assertInvalid(StudySessionDTO request, String field) {
        var ctx = new ValidationContext();
        assertNull(resolver.resolve(request, ctx));
        assertTrue(ctx.getErrors().containsKey(field), ctx.getErrors().toString());
    }
}
