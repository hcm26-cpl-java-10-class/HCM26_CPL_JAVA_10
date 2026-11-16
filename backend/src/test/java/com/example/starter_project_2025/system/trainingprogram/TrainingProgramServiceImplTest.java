package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.subject.SubjectStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrainingProgramServiceImplTest {

    @Mock
    private TrainingProgramRepository programRepository;
    @Mock
    private SubjectRepository subjectRepository;
    @Mock
    private TeachingAssignmentRepository teachingAssignmentRepository;
    @Mock
    private ClassTrainingProgramRepository classTrainingProgramRepository;

    private TrainingProgramServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new TrainingProgramServiceImpl(
                programRepository,
                subjectRepository,
                teachingAssignmentRepository,
                classTrainingProgramRepository);
    }

    @Test
    void create_normalizesMetadataSnapshotsAndCalculatesTotalHours() {
        Subject s1 = Subject.builder().id(145L).code("JAVA_CORE").name("Java Core").version("1.0").durationHours(40)
                .status(SubjectStatus.ACTIVE).isActive(true).build();
        Subject s2 = Subject.builder().id(146L).code("SPRING_BOOT").name("Spring Boot").version("1.0").durationHours(48)
                .status(SubjectStatus.ACTIVE).isActive(true).build();

        when(programRepository.existsByNormalizedIdentity("JAVA_TRACK", "1.0", null)).thenReturn(false);
        when(subjectRepository.findById(145L)).thenReturn(Optional.of(s1));
        when(subjectRepository.findById(146L)).thenReturn(Optional.of(s2));
        when(programRepository.save(any(TrainingProgram.class))).thenAnswer(inv -> {
            TrainingProgram saved = inv.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(10L);
            }
            return saved;
        });

        TrainingProgramRequest request = new TrainingProgramRequest(
                "  java_track ",
                "  Java Track  ",
                " 1.0 ",
                "  HCM  ",
                " Java ",
                " ",
                "  Core backend track ",
                null,
                List.of(
                        new ProgramSubjectRequest(145L, 1),
                        new ProgramSubjectRequest(146L, 2)));

        TrainingProgramResponse response = service.create(request);

        assertEquals(10L, response.id());
        assertEquals("JAVA_TRACK", response.code());
        assertEquals("Java Track", response.name());
        assertEquals("1.0", response.version());
        assertEquals("HCM", response.region());
        assertNull(response.contentLink());
        assertEquals(ProgramStatus.ACTIVE, response.status());
        assertTrue(response.isActive());
        assertEquals(88, response.totalDurationHours());
        assertEquals(2, response.subjects().size());
        verify(programRepository, times(1)).save(any(TrainingProgram.class));
    }

    @Test
    void create_rejectsSubjectWithInactiveStatusEvenIfLegacyFlagIsTrue() {
        Subject inconsistent = Subject.builder()
                .id(144L)
                .code("LEGACY_JAVA_7")
                .name("Legacy Java 7")
                .version("1.0")
                .durationHours(24)
                .status(SubjectStatus.INACTIVE)
                .isActive(true)
                .build();

        when(programRepository.existsByNormalizedIdentity("LEGACY_PROG", "1.0", null)).thenReturn(false);
        when(subjectRepository.findById(144L)).thenReturn(Optional.of(inconsistent));

        TrainingProgramRequest request = new TrainingProgramRequest(
                "LEGACY_PROG",
                "Legacy Program",
                "1.0",
                "HCM",
                "Java",
                null,
                null,
                ProgramStatus.ACTIVE,
                List.of(new ProgramSubjectRequest(144L, 1)));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.create(request));
        assertTrue(ex.getMessage().contains("inactive"));
        verify(programRepository, never()).save(any());
    }

    @Test
    void update_blocksWhenAssignedToClassAndAllowsCloneInstead() {
        TrainingProgram existing = TrainingProgram.builder()
                .id(3L)
                .code("FULLSTACK_JAVA")
                .name("Fullstack")
                .version("1.0")
                .status(ProgramStatus.ACTIVE)
                .isActive(true)
                .build();

        when(programRepository.findById(3L)).thenReturn(Optional.of(existing));
        when(classTrainingProgramRepository.existsByProgram_Id(3L)).thenReturn(true);

        TrainingProgramRequest request = new TrainingProgramRequest(
                "FULLSTACK_JAVA", "Fullstack Updated", "1.0", "HCM", "Java", null, null,
                ProgramStatus.ACTIVE, List.of(new ProgramSubjectRequest(145L, 1)));

        assertThrows(ConflictException.class, () -> service.update(3L, request));
    }

    @Test
    void delete_blocksWhenReferencedByClassOrTeachingAssignment() {
        Subject subject = Subject.builder().id(145L).code("JAVA_CORE").name("Java Core").version("1.0")
                .durationHours(40).status(SubjectStatus.ACTIVE).isActive(true).build();
        TrainingProgram program = TrainingProgram.builder().id(3L).code("FULLSTACK_JAVA").name("Fullstack")
                .version("1.0").status(ProgramStatus.ACTIVE).isActive(true).build();
        ProgramSubject ps = ProgramSubject.builder().id(95L).program(program).subject(subject).orderIndex(1).build();
        program.getSubjects().add(ps);

        when(programRepository.findById(3L)).thenReturn(Optional.of(program));
        when(classTrainingProgramRepository.existsByProgram_Id(3L)).thenReturn(false);
        when(teachingAssignmentRepository.existsByProgramSubject_Id(95L)).thenReturn(true);

        assertThrows(ConflictException.class, () -> service.delete(3L));
        verify(programRepository, never()).delete(any(TrainingProgram.class));

        when(teachingAssignmentRepository.existsByProgramSubject_Id(95L)).thenReturn(false);
        service.delete(3L);
        verify(programRepository).delete(program);
    }
}