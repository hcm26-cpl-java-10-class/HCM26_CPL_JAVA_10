package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.subject.SubjectStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrainingProgramImportServiceTest {

    @Mock
    private TrainingProgramRepository programRepository;
    @Mock
    private SubjectRepository subjectRepository;
    @Mock
    private TrainingProgramService programService;

    private TrainingProgramImportService importService;

    @BeforeEach
    void setUp() {
        importService = new TrainingProgramImportService(programRepository, subjectRepository, programService);
    }

    @Test
    void preview_usesNormalizedSubjectIdentityAndReportsInactiveOrGapErrors() {
        String csv = """
                programCode,programName,programVersion,region,subjectCode,subjectVersion,orderIndex
                JAVA_PRO,Java Pro,1.0,HCM,java_core,v1.0,1
                JAVA_PRO,Java Pro,1.0,HCM,LEGACY_JAVA_7,1.0,3
                """;
        MockMultipartFile file = new MockMultipartFile(
                "file", "programs.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        Subject activeJava = Subject.builder()
                .id(145L).code("JAVA_CORE").name("Java Core").version("1.0")
                .durationHours(40).status(SubjectStatus.ACTIVE).isActive(true).build();
        Subject inactiveLegacy = Subject.builder()
                .id(144L).code("LEGACY_JAVA_7").name("Legacy").version("1.0")
                .durationHours(24).status(SubjectStatus.INACTIVE).isActive(true).build();

        when(programRepository.findAllIdentityPairs()).thenReturn(List.of());
        when(subjectRepository.findByNormalizedIdentity("JAVA_CORE", List.of("1.0", "v1.0")))
                .thenReturn(Optional.of(activeJava));
        when(subjectRepository.findByNormalizedIdentity("LEGACY_JAVA_7", List.of("1.0", "v1.0")))
                .thenReturn(Optional.of(inactiveLegacy));

        ProgramImportPreviewResponse preview = importService.preview(file);

        assertEquals(2, preview.totalRows());
        assertEquals(2, preview.invalidRows());
        assertFalse(preview.canImport());
        assertTrue(preview.rows().get(0).errors().stream().anyMatch(e -> e.contains("consecutive")));
        assertTrue(preview.rows().get(1).errors().stream().anyMatch(e -> e.contains("INACTIVE")));
        verify(programRepository, never()).findAll();
    }

    @Test
    void importAll_groupsAndImportsValidRowsUsingNormalizedSubjects() {
        String csv = """
                programCode,programName,programVersion,region,subjectCode,subjectVersion,orderIndex
                JAVA_PRO,Java Pro,1.0,HCM,java_core,v1.0,1
                JAVA_PRO,Java Pro,1.0,HCM,spring_boot,1.0,2
                """;
        MockMultipartFile file = new MockMultipartFile(
                "file", "valid-programs.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        Subject s1 = Subject.builder().id(145L).code("JAVA_CORE").name("Java Core").version("1.0")
                .durationHours(40).status(SubjectStatus.ACTIVE).isActive(true).build();
        Subject s2 = Subject.builder().id(146L).code("SPRING_BOOT").name("Spring Boot").version("1.0")
                .durationHours(48).status(SubjectStatus.ACTIVE).isActive(true).build();

        when(programRepository.findAllIdentityPairs()).thenReturn(List.of());
        when(subjectRepository.findByNormalizedIdentity("JAVA_CORE", List.of("1.0", "v1.0")))
                .thenReturn(Optional.of(s1));
        when(subjectRepository.findByNormalizedIdentity("SPRING_BOOT", List.of("1.0", "v1.0")))
                .thenReturn(Optional.of(s2));

        int count = importService.importAll(file);

        assertEquals(1, count);
        ArgumentCaptor<TrainingProgramRequest> captor = ArgumentCaptor.forClass(TrainingProgramRequest.class);
        verify(programService, times(1)).create(captor.capture());
        assertEquals("JAVA_PRO", captor.getValue().code());
        assertEquals(2, captor.getValue().subjects().size());
        assertEquals(145L, captor.getValue().subjects().get(0).subjectId());
        assertEquals(146L, captor.getValue().subjects().get(1).subjectId());
    }
}

