package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.trainingprogram.ProgramSubjectRepository;
import com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentRepository;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubjectServiceImplTest {

    @Mock
    private SubjectRepository subjectRepository;
    @Mock
    private SubjectSyllabusRepository subjectSyllabusRepository;
    @Mock
    private SessionRepository sessionRepository;
    @Mock
    private ProgramSubjectRepository programSubjectRepository;
    @Mock
    private TeachingAssignmentRepository teachingAssignmentRepository;

    private SubjectMapper subjectMapper;
    private SubjectValidator subjectValidator;
    private SubjectServiceImpl subjectService;

    @BeforeEach
    void setUp() {
        subjectMapper = Mappers.getMapper(SubjectMapper.class);
        Validator beanValidator = Validation.buildDefaultValidatorFactory().getValidator();
        subjectValidator = new SubjectValidator(subjectRepository, beanValidator);
        subjectService = new SubjectServiceImpl(
                subjectMapper,
                subjectRepository,
                subjectSyllabusRepository,
                subjectValidator,
                sessionRepository,
                programSubjectRepository,
                teachingAssignmentRepository
        );
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken(
                        "tester",
                        "password",
                        "SUBJECT_READ", "SUBJECT_CREATE", "SUBJECT_UPDATE", "SUBJECT_DELETE"
                )
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void create_normalizesIdentityAndStatus() {
        SubjectDTO request = SubjectDTO.builder()
                .code("  java_core ")
                .name("  Java Core Fundamentals  ")
                .version(" v1.0 ")
                .technicalGroup("  Java  ")
                .durationHours(40)
                .status(null)
                .build();

        when(subjectRepository.existsByNormalizedIdentity("JAVA_CORE", List.of("1.0", "v1.0"), null))
                .thenReturn(false);
        when(subjectRepository.save(any(Subject.class))).thenAnswer(inv -> {
            Subject entity = inv.getArgument(0);
            entity.setId(1L);
            return entity;
        });

        SubjectDTO created = subjectService.create(request);

        ArgumentCaptor<Subject> captor = ArgumentCaptor.forClass(Subject.class);
        verify(subjectRepository).save(captor.capture());
        Subject saved = captor.getValue();

        assertEquals("JAVA_CORE", saved.getCode());
        assertEquals("1.0", saved.getVersion());
        assertEquals("Java Core Fundamentals", saved.getName());
        assertEquals("Java", saved.getTechnicalGroup());
        assertEquals(SubjectStatus.ACTIVE, saved.getStatus());
        assertTrue(saved.getIsActive());
        assertEquals("JAVA_CORE", created.getCode());
    }

    @Test
    void create_rejectsDuplicateNormalizedIdentity() {
        SubjectDTO request = SubjectDTO.builder()
                .code("java_core")
                .name("Java Core")
                .version("v1.0")
                .durationHours(40)
                .build();

        when(subjectRepository.existsByNormalizedIdentity("JAVA_CORE", List.of("1.0", "v1.0"), null))
                .thenReturn(true);

        BusinessValidationException ex = assertThrows(
                BusinessValidationException.class,
                () -> subjectService.create(request)
        );
        assertTrue(ex.getErrors().containsKey("code"));
        verify(subjectRepository, never()).save(any());
    }

    @Test
    void create_rejectsExcessDurationAndNumericTechnicalGroup() {
        SubjectDTO request = SubjectDTO.builder()
                .code("JAVA_BAD")
                .name("Bad Topic")
                .version("1.0")
                .technicalGroup("12345")
                .durationHours(1001)
                .build();

        when(subjectRepository.existsByNormalizedIdentity("JAVA_BAD", List.of("1.0", "v1.0"), null))
                .thenReturn(false);

        BusinessValidationException ex = assertThrows(
                BusinessValidationException.class,
                () -> subjectService.create(request)
        );
        assertTrue(ex.getErrors().containsKey("durationHours"));
        assertTrue(ex.getErrors().containsKey("technicalGroup"));
        verify(subjectRepository, never()).save(any());
    }

    @Test
    void update_allowsUpdatingOwnRecordWithoutDuplicateError() {
        Subject existing = Subject.builder()
                .id(10L)
                .code("SPRING_BOOT")
                .name("Spring Boot Old")
                .version("1.0")
                .durationHours(48)
                .status(SubjectStatus.ACTIVE)
                .isActive(true)
                .build();

        SubjectDTO request = SubjectDTO.builder()
                .name("  Spring Boot Updated ")
                .technicalGroup("   ")
                .durationHours(52)
                .build();
        request.setIsActive(false);

        when(subjectRepository.findById(10L)).thenReturn(Optional.of(existing));
        when(subjectRepository.existsByNormalizedIdentity("SPRING_BOOT", List.of("1.0", "v1.0"), 10L))
                .thenReturn(false);
        when(subjectRepository.save(any(Subject.class))).thenAnswer(inv -> inv.getArgument(0));

        SubjectDTO updated = subjectService.update(10L, request);

        assertEquals("Spring Boot Updated", updated.getName());
        assertNull(updated.getTechnicalGroup());
        assertEquals(SubjectStatus.INACTIVE, updated.getStatus());
        assertFalse(updated.getIsActive());
    }

    @Test
    void changeStatus_updatesStatusAndThrowsWhenMissing() {
        Subject existing = Subject.builder()
                .id(5L)
                .code("REACT_TS")
                .name("React")
                .version("1.0")
                .durationHours(40)
                .status(SubjectStatus.ACTIVE)
                .isActive(true)
                .build();

        when(subjectRepository.findById(5L)).thenReturn(Optional.of(existing));
        when(subjectRepository.save(any(Subject.class))).thenAnswer(inv -> inv.getArgument(0));

        SubjectDTO toggled = subjectService.changeStatus(5L, false);
        assertEquals(SubjectStatus.INACTIVE, toggled.getStatus());
        assertFalse(toggled.getIsActive());

        when(subjectRepository.findById(99L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> subjectService.changeStatus(99L, true));
    }

    @Test
    void delete_blocksWhenReferencedAndAllowsWhenUnreferenced() {
        Subject subject = Subject.builder()
                .id(7L)
                .code("SQL_101")
                .name("SQL")
                .version("1.0")
                .durationHours(32)
                .build();

        when(subjectRepository.findById(7L)).thenReturn(Optional.of(subject));
        when(sessionRepository.existsByTopicId(7L)).thenReturn(false);
        when(programSubjectRepository.existsBySubject_Id(7L)).thenReturn(true);

        assertThrows(BadRequestException.class, () -> subjectService.delete(7L));
        verify(subjectRepository, never()).delete(any(Subject.class));

        when(programSubjectRepository.existsBySubject_Id(7L)).thenReturn(false);
        when(teachingAssignmentRepository.existsByProgramSubject_Subject_Id(7L)).thenReturn(false);

        subjectService.delete(7L);
        verify(subjectSyllabusRepository).deleteBySubject_Id(7L);
        verify(subjectRepository).delete(subject);
    }
}
