package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder;
import com.example.starter_project_2025.base.dataio.importer.mapper.ValueConverter;
import com.example.starter_project_2025.base.dataio.importer.parser.*;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.*;
import com.example.starter_project_2025.system.schedule.*;
import com.example.starter_project_2025.system.subject.*;
import com.example.starter_project_2025.system.trainingprogram.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.transaction.annotation.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Isolated test DB fixtures only; nothing is inserted into the running application. */
@DataJpaTest(properties={"spring.jpa.hibernate.ddl-auto=create-drop","spring.jpa.show-sql=false"})
@ContextConfiguration(classes=SessionImportAssignmentIntegrationTest.Config.class)
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class SessionImportAssignmentIntegrationTest {
    @TestConfiguration
    @EntityScan(basePackageClasses={Session.class,ScheduleWriteLock.class,TeachingAssignment.class,Subject.class})
    @EnableJpaRepositories(basePackageClasses={SessionRepository.class,ScheduleWriteLockRepository.class,TeachingAssignmentRepository.class,SubjectRepository.class})
    @Import({SessionServiceImpl.class,SessionMapperImpl.class,ScheduleValidationEngine.class,ScheduleRules.class,
            TeachingAssignmentSessionGuard.class,SessionImportAssignmentPolicy.class,SessionImportAvailableAssignments.class,SessionImportCoordinator.class,
            SessionImportService.class,ParserFactory.class,ExcelParser.class,CsvParser.class,ValueConverter.class})
    static class Config {}

    @MockBean AutoSpecBuilder autoSpecBuilder;
    @MockBean ClassSetupService classSetup;
    @MockBean ExternalApiService resources;
    @MockBean ScheduleReferenceProvider references;
    @Autowired TeachingAssignmentRepository assignments;
    @Autowired ProgramSubjectRepository programSubjects;
    @Autowired TrainingProgramRepository programs;
    @Autowired SubjectRepository subjects;
    @Autowired SessionRepository sessions;
    @Autowired ScheduleWriteLockRepository locks;
    @Autowired SessionImportService imports;
    @Autowired SessionImportCoordinator coordinator;
    @Autowired SessionImportAssignmentPolicy policy;
    TeachingAssignment assignment;
    Subject subject;
    ProgramSubject curriculum;
    TrainingProgram program;
    final long classId=41001,trainerId=52001,topicId=63001,roomId=74001;

    @BeforeEach void setup() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("fixture-scheduler","",
                List.of(new SimpleGrantedAuthority("SESSION_READ"),new SimpleGrantedAuthority("SESSION_CREATE"))));
        sessions.deleteAll(); assignments.deleteAll(); programSubjects.deleteAll(); programs.deleteAll(); subjects.deleteAll();
        locks.saveAndFlush(new ScheduleWriteLock(1L));
        var unused=Subject.builder().code("FIXTURE_UNUSED").name("Unused fixture").version("1.0").durationHours(1).status(SubjectStatus.ACTIVE).isActive(true).build();
        subjects.saveAndFlush(unused);
        subject=subjects.saveAndFlush(Subject.builder().code("FIXTURE_SUBJECT").name("Fixture subject").version("1.0").durationHours(8).status(SubjectStatus.ACTIVE).isActive(true).build());
        program=programs.saveAndFlush(TrainingProgram.builder().code("FIXTURE_PROGRAM").name("Fixture program").version("1.0").status(ProgramStatus.ACTIVE).isActive(true).build());
        curriculum=programSubjects.saveAndFlush(new ProgramSubject(null,program,subject,1));
        assignment=new TeachingAssignment(); assignment.setClassId(classId); assignment.setTrainerId(trainerId);
        assignment.setProgramSubject(curriculum); assignment.setRole(AssignmentRole.MAIN); assignment.setIsActive(true);
        assignment.setEffectiveFrom(LocalDate.of(2026,1,1)); assignment.setEffectiveTo(LocalDate.of(2027,12,31));
        assignment=assignments.saveAndFlush(assignment);
        when(resources.isSampleData()).thenReturn(false);
        available(List.of(response(assignment)));
        when(references.load()).thenReturn(new ScheduleReferences(
                List.of(ExternalClassDTO.builder().id(classId).code("FIXTURE_CLASS").name("Fixture class").status("ACTIVE").startDate("2026-01-01").endDate("2027-12-31").build()),
                List.of(ExternalTrainerDTO.builder().id(trainerId).name("Fixture trainer").status("ACTIVE").build()),
                List.of(ExternalRoomDTO.builder().id(roomId).name("Fixture room").capacity(20).build()),
                List.of(new ScheduleReferences.Assignment(assignment.getId(),classId,topicId,trainerId,assignment.getEffectiveFrom(),assignment.getEffectiveTo(),"ACTIVE")),List.of()));
    }
    @AfterEach void clear(){SecurityContextHolder.clearContext();}

    @Test void previewRecheckAndImportUseExistingAssignmentWithoutMappingTopicToSubject() {
        var preview=imports.preview(file(null));
        assertTrue(preview.canImport()); assertEquals(0,sessions.count());
        assertEquals(assignment.getId().toString(),preview.rows().getFirst().values().get("Teaching Assignment ID"));
        assertFalse(assignments.findById(assignment.getId()).orElseThrow().getEverUsed());
        var values=new LinkedHashMap<>(preview.rows().getFirst().values());values.put("Session Title","Edited fixture session");
        var edited=new SessionImportRowsRequest(List.of(new SessionImportRowsRequest.Row(17,values)));
        assertTrue(imports.previewRows(edited).canImport());assertEquals(0,sessions.count());
        assertEquals(1,imports.importRows(edited).getSuccessCount());
        var saved=sessions.findAll().getFirst();
        assertEquals(assignment.getId(),saved.getTeachingAssignmentId()); assertEquals(topicId,saved.getTopicId());
        assertNotEquals(subject.getId(),saved.getTopicId());assertNotEquals(curriculum.getId(),saved.getTopicId());
        assertEquals("Edited fixture session",saved.getTitle());
        assertTrue(assignments.findById(assignment.getId()).orElseThrow().getEverUsed());
    }

    @Test void nonexistentAssignmentReportsOriginalRowAndColumnAndNeverWrites() {
        var request=rows(assignment.getId()+10000);
        var preview=imports.previewRows(request);assertFalse(preview.canImport());
        assertEquals(17,preview.rows().getFirst().rowNumber());
        String error=preview.rows().getFirst().errors().getFirst();
        assertTrue(error.contains("column D")); assertTrue(error.contains("does not exist")); assertTrue(error.contains("/teaching-assignments/available"));
        assertEquals(0,imports.importRows(request).getSuccessCount());assertEquals(0,sessions.count());
    }

    @Test void blankWithoutAnEligibleAssignmentIsNotABypass() {
        available(List.of());
        var request=rows(null);var preview=imports.previewRows(request);
        assertFalse(preview.canImport());assertTrue(preview.rows().getFirst().errors().getFirst().contains("is blank"));
        assertEquals(0,imports.importRows(request).getSuccessCount());assertEquals(0,sessions.count());
    }

    @Test void ambiguousBlankRequiresAnExplicitExistingId() {
        available(List.of(response(assignment),response(assignment)));
        var preview=imports.previewRows(rows(null));
        assertFalse(preview.canImport());assertTrue(preview.rows().getFirst().errors().getFirst().contains("More than one"));
        assertEquals(0,sessions.count());
    }

    @ParameterizedTest @ValueSource(strings={"inactive","wrong-class","wrong-trainer","before","after","inactive-subject","inactive-program"})
    void rejectsCurrentInvalidAssignmentDespiteStaleAvailableResponse(String kind) {
        var request=rows(assignment.getId());
        var values=new LinkedHashMap<>(request.rows().getFirst().values());
        switch(kind){
            case "inactive" -> {assignment.setIsActive(false);assignments.saveAndFlush(assignment);}
            case "wrong-class" -> values.put("Class ID",Long.toString(classId+10));
            case "wrong-trainer" -> values.put("Trainer ID",Long.toString(trainerId+10));
            case "before" -> {values.put("Start Time","2025-12-31T09:00");values.put("End Time","2025-12-31T10:00");}
            case "after" -> {values.put("Start Time","2028-01-01T09:00");values.put("End Time","2028-01-01T10:00");}
            case "inactive-subject" -> {subject.setStatus(SubjectStatus.INACTIVE);subjects.saveAndFlush(subject);}
            case "inactive-program" -> {program.setStatus(ProgramStatus.INACTIVE);programs.saveAndFlush(program);}
        }
        var edited=new SessionImportRowsRequest(List.of(new SessionImportRowsRequest.Row(17,values)));
        assertFalse(imports.previewRows(edited).canImport(),kind);
        assertEquals(0,imports.importRows(edited).getSuccessCount(),kind);assertEquals(0,sessions.count(),kind);
    }

    @Test void dateAndCurriculumEligibilityAreReadFromTheOfficialAvailableService() {
        available(List.of());
        assertFalse(imports.previewRows(rows(assignment.getId())).canImport());
        verify(classSetup).getAvailableClassAssignments(eq(classId),isNull(),isNull(),eq(LocalDateTime.of(2026,10,28,9,0)),eq(LocalDateTime.of(2026,10,28,10,0)));
        assertEquals(0,sessions.count());
    }

    @Test void substitutingSubjectIdForTopicIdFailsTheIndependentTopicCheck() {
        var request=rows(assignment.getId());var values=new LinkedHashMap<>(request.rows().getFirst().values());values.put("Topic ID",subject.getId().toString());
        var edited=new SessionImportRowsRequest(List.of(new SessionImportRowsRequest.Row(17,values)));
        assertFalse(imports.previewRows(edited).canImport());assertEquals(0,imports.importRows(edited).getSuccessCount());
    }

    @Test void saveRechecksAssignmentAfterAnEarlierSuccessfulPreview() {
        assertTrue(imports.previewRows(rows(assignment.getId())).canImport());
        assignment.setIsActive(false);assignments.saveAndFlush(assignment);
        var dto=SessionDTO.builder().classId(classId).topicId(topicId).trainerId(trainerId).teachingAssignmentId(assignment.getId())
                .roomId(roomId).title("Fixture session").startTime(LocalDateTime.of(2026,10,28,9,0)).endTime(LocalDateTime.of(2026,10,28,10,0)).build();
        assertThrows(ScheduleValidationException.class,()->coordinator.createValidatedBatch(List.of(dto)));
        assertEquals(0,sessions.count());assertFalse(assignments.findById(assignment.getId()).orElseThrow().getEverUsed());
    }

    @Test void sampleResourcesAndScheduleDemoCannotCertifyAnImport() {
        when(resources.isSampleData()).thenReturn(true);
        assertFalse(imports.previewRows(rows(assignment.getId())).canImport());
        when(resources.isSampleData()).thenReturn(false);
        var env=new MockEnvironment();env.setActiveProfiles("schedule-demo");
        var isolated=new SessionImportAssignmentPolicy(assignments,new SessionImportAvailableAssignments(classSetup),resources,env);
        var dto=SessionDTO.builder().classId(classId).topicId(topicId).trainerId(trainerId)
                .startTime(LocalDateTime.of(2026,10,28,9,0)).endTime(LocalDateTime.of(2026,10,28,10,0)).build();
        assertTrue(isolated.validateAndResolve(List.of(dto)).stream().anyMatch(issue->issue.code().equals("IMPORT_REFERENCE_SOURCE")));
        assertEquals(0,sessions.count());
    }

    @Test void missingClassAndUnavailableDirectoryAreReportedPerRowWithoutPoisoningPreview() {
        when(classSetup.getAvailableClassAssignments(anyLong(),isNull(),isNull(),any(),any()))
                .thenThrow(new com.example.starter_project_2025.exception.ResourceNotFoundException("Class not found"));
        var preview=imports.previewRows(rows(assignment.getId()));
        assertFalse(preview.canImport());assertEquals(17,preview.rows().getFirst().rowNumber());
        assertTrue(preview.rows().getFirst().errors().getFirst().contains("Class not found"));
        assertEquals(0,imports.importRows(rows(assignment.getId())).getSuccessCount());
        doThrow(new com.example.starter_project_2025.system.external_api.exception.ExternalApiException("offline"))
                .when(classSetup).getAvailableClassAssignments(anyLong(),isNull(),isNull(),any(),any());
        assertTrue(imports.previewRows(rows(assignment.getId())).rows().getFirst().errors().getFirst().contains("authoritative resource API is unavailable"));
        assertEquals(0,sessions.count());
    }

    @Test void missingTopicReferenceSourceReturnsRowErrorsWithoutSaving() {
        doThrow(new com.example.starter_project_2025.system.external_api.exception.ExternalApiException("offline"))
                .when(references).load();
        var preview=imports.previewRows(rows(assignment.getId()));
        assertFalse(preview.canImport());assertEquals(17,preview.rows().getFirst().rowNumber());
        assertTrue(preview.rows().getFirst().errors().getFirst().contains("Topic ID (column B)"));
        assertEquals(0,imports.importRows(rows(assignment.getId())).getSuccessCount());
        assertEquals(0,sessions.count());
    }

    @Test void sourceFailureAtFinalSaveReturnsOriginalRowAndRollsBack() {
        var snapshot=references.load();
        when(references.load()).thenReturn(snapshot)
                .thenThrow(new com.example.starter_project_2025.system.external_api.exception.ExternalApiException("offline"));
        var result=imports.importRows(rows(assignment.getId()));
        assertEquals(0,result.getSuccessCount());assertEquals(1,result.getFailureCount());
        assertEquals(17,result.getErrors().getFirst().getRowNumber());
        assertTrue(result.getErrors().getFirst().getMessage().contains("no sessions were imported"));
        assertEquals(0,sessions.count());
    }

    private void available(List<TeachingAssignmentResponse> rows){when(classSetup.getAvailableClassAssignments(anyLong(),isNull(),isNull(),any(),any())).thenReturn(rows);}
    private TeachingAssignmentResponse response(TeachingAssignment a){return new TeachingAssignmentResponse(a.getId(),classId,"FIXTURE_CLASS",curriculum.getId(),subject.getId(),subject.getCode(),subject.getName(),trainerId,"Fixture trainer",a.getRole(),a.getEffectiveFrom(),a.getEffectiveTo(),"Fixture class",subject.getVersion(),null,program.getId(),program.getCode(),program.getName(),program.getVersion(),a.getRevision());}
    private SessionImportRowsRequest rows(Long id){var values=new LinkedHashMap<String,String>();values.put("Class ID",Long.toString(classId));values.put("Topic ID",Long.toString(topicId));values.put("Trainer ID",Long.toString(trainerId));values.put("Teaching Assignment ID",id==null?"":id.toString());values.put("Room ID",Long.toString(roomId));values.put("Session Title","Fixture session");values.put("Start Time","2026-10-28T09:00");values.put("End Time","2026-10-28T10:00");return new SessionImportRowsRequest(List.of(new SessionImportRowsRequest.Row(17,values)));}
    private MockMultipartFile file(Long id){String csv="Class ID,Topic ID,Trainer ID,Teaching Assignment ID,Room ID,Session Title,Start Time,End Time\n"+classId+","+topicId+","+trainerId+","+(id==null?"":id)+","+roomId+",Fixture session,2026-10-28T09:00,2026-10-28T10:00\n";return new MockMultipartFile("file","fixtures.csv","text/csv",csv.getBytes(StandardCharsets.UTF_8));}
}