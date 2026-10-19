package com.example.starter_project_2025.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.class_setup.*;
import com.example.starter_project_2025.system.class_setup.dto.*;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.training_program.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClassSetupServiceTest {

    @Mock
    private TrainingClassRepository trainingClassRepository;

    @Mock
    private TeachingAssignmentRepository teachingAssignmentRepository;

    @Mock
    private EnrollmentRepository enrollmentRepository;

    @Mock
    private TrainingProgramRepository trainingProgramRepository;

    @Mock
    private ProgramSubjectRepository programSubjectRepository;

    @Mock
    private SubjectRepository subjectRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SessionRepository sessionRepository;

    @InjectMocks
    private ClassSetupServiceImpl classSetupService;

    private TrainingClass mockClass;
    private TrainingProgram mockActiveProgram;
    private TrainingProgram mockDraftProgram;
    private ProgramSubject mockProgramSubject;
    private Subject mockSubject;
    private User mockTrainer;

    @BeforeEach
    void setUp() {
        mockClass = TrainingClass.builder()
                .id(1L)
                .code("HCM26_CPL_JAVA_10")
                .name("HCM26 CPL Java 10")
                .programId(null)
                .startDate(LocalDate.of(2026, 10, 1))
                .endDate(LocalDate.of(2026, 12, 31))
                .status(ClassStatus.IN_PROGRESS)
                .isActive(true)
                .build();

        mockActiveProgram = TrainingProgram.builder()
                .id(10L)
                .code("PROG_JAVA")
                .name("Java Developer")
                .version(1)
                .status(ProgramStatus.ACTIVE)
                .isActive(true)
                .subjects(new ArrayList<>())
                .build();

        mockDraftProgram = TrainingProgram.builder()
                .id(11L)
                .code("PROG_JAVA_DRAFT")
                .name("Java Developer Draft")
                .version(2)
                .status(ProgramStatus.DRAFT)
                .isActive(true)
                .subjects(new ArrayList<>())
                .build();

        mockSubject = Subject.builder()
                .id(100L)
                .code("JAVA_CORE")
                .name("Java Core Fundamentals")
                .durationHours(40)
                .build();

        mockProgramSubject = ProgramSubject.builder()
                .id(101L)
                .program(mockActiveProgram)
                .subjectId(100L)
                .orderIndex(1)
                .build();
        mockActiveProgram.getSubjects().add(mockProgramSubject);

        mockTrainer = User.builder()
                .id(5L)
                .email("teacher@example.com")
                .firstName("Nguyen Van")
                .lastName("A")
                .isActive(true)
                .build();
    }

    // =========================================================================
    // 1. Tests for assignTrainingProgram
    // =========================================================================

    @Test
    @DisplayName("Gán chương trình thành công khi chương trình ở trạng thái ACTIVE")
    void assignTrainingProgram_Success() {
        when(trainingClassRepository.findById(1L)).thenReturn(Optional.of(mockClass));
        when(trainingProgramRepository.findById(10L)).thenReturn(Optional.of(mockActiveProgram));
        when(teachingAssignmentRepository.existsByClassIdAndIsActiveTrue(1L)).thenReturn(false);
        when(sessionRepository.findByClassId(1L)).thenReturn(Collections.emptyList());
        when(trainingClassRepository.save(any(TrainingClass.class))).thenReturn(mockClass);

        TrainingClassResponse response = classSetupService.assignTrainingProgram(1L, 10L);

        assertNotNull(response);
        assertEquals(10L, mockClass.getProgramId());
        verify(trainingClassRepository).save(mockClass);
    }

    @Test
    @DisplayName("Chặn gán chương trình khi chương trình ở trạng thái DRAFT")
    void assignTrainingProgram_FailsWhenProgramNotActive() {
        when(trainingClassRepository.findById(1L)).thenReturn(Optional.of(mockClass));
        when(trainingProgramRepository.findById(11L)).thenReturn(Optional.of(mockDraftProgram));

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                classSetupService.assignTrainingProgram(1L, 11L));
        assertTrue(ex.getMessage().contains("ACTIVE"));
    }

    @Test
    @DisplayName("Chặn gán chương trình khi lớp đã có phân công giảng dạy")
    void assignTrainingProgram_FailsWhenClassHasAssignments() {
        when(trainingClassRepository.findById(1L)).thenReturn(Optional.of(mockClass));
        when(trainingProgramRepository.findById(10L)).thenReturn(Optional.of(mockActiveProgram));
        when(teachingAssignmentRepository.existsByClassIdAndIsActiveTrue(1L)).thenReturn(true);

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                classSetupService.assignTrainingProgram(1L, 10L));
        assertTrue(ex.getMessage().contains("phân công giảng dạy"));
    }

    // =========================================================================
    // 2. Tests for createTeachingAssignment
    // =========================================================================

    @Test
    @DisplayName("Tạo phân công giảng dạy thành công với vai trò MAIN")
    void createTeachingAssignment_Success() {
        mockClass.setProgramId(10L);
        when(trainingClassRepository.findById(1L)).thenReturn(Optional.of(mockClass));
        when(programSubjectRepository.findById(101L)).thenReturn(Optional.of(mockProgramSubject));
        when(userRepository.findById(5L)).thenReturn(Optional.of(mockTrainer));
        when(teachingAssignmentRepository.findOverlappingAssignments(eq(1L), eq(101L), eq(5L), any(), any(), isNull()))
                .thenReturn(Collections.emptyList());

        TeachingAssignment savedAssignment = TeachingAssignment.builder()
                .id(501L)
                .classId(1L)
                .programSubjectId(101L)
                .trainerId(5L)
                .role(AssignmentRole.MAIN)
                .effectiveFrom(LocalDate.of(2026, 10, 20))
                .effectiveTo(LocalDate.of(2026, 11, 30))
                .isActive(true)
                .build();
        when(teachingAssignmentRepository.save(any(TeachingAssignment.class))).thenReturn(savedAssignment);
        when(subjectRepository.findById(100L)).thenReturn(Optional.of(mockSubject));

        TeachingAssignmentRequest request = new TeachingAssignmentRequest(
                1L, 101L, 5L, AssignmentRole.MAIN,
                LocalDate.of(2026, 10, 20), LocalDate.of(2026, 11, 30)
        );

        TeachingAssignmentResponse response = classSetupService.createTeachingAssignment(request);

        assertNotNull(response);
        assertEquals(501L, response.id());
        assertEquals("HCM26_CPL_JAVA_10", response.classCode());
        assertEquals("JAVA_CORE", response.subjectCode());
        assertEquals("Nguyen Van A", response.trainerName());
        assertEquals(AssignmentRole.MAIN, response.role());
    }

    @Test
    @DisplayName("Chặn phân công khi giảng viên đã ngừng hoạt động")
    void createTeachingAssignment_FailsWhenTrainerInactive() {
        mockClass.setProgramId(10L);
        mockTrainer.setIsActive(false);

        when(trainingClassRepository.findById(1L)).thenReturn(Optional.of(mockClass));
        when(programSubjectRepository.findById(101L)).thenReturn(Optional.of(mockProgramSubject));
        when(userRepository.findById(5L)).thenReturn(Optional.of(mockTrainer));

        TeachingAssignmentRequest request = new TeachingAssignmentRequest(
                1L, 101L, 5L, AssignmentRole.MAIN,
                LocalDate.of(2026, 10, 20), LocalDate.of(2026, 11, 30)
        );

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                classSetupService.createTeachingAssignment(request));
        assertTrue(ex.getMessage().contains("ngừng hoạt động"));
    }

    @Test
    @DisplayName("Chặn phân công khi trùng lặp thời gian")
    void createTeachingAssignment_FailsWhenOverlapping() {
        mockClass.setProgramId(10L);
        when(trainingClassRepository.findById(1L)).thenReturn(Optional.of(mockClass));
        when(programSubjectRepository.findById(101L)).thenReturn(Optional.of(mockProgramSubject));
        when(userRepository.findById(5L)).thenReturn(Optional.of(mockTrainer));

        TeachingAssignment existing = TeachingAssignment.builder().id(99L).build();
        when(teachingAssignmentRepository.findOverlappingAssignments(eq(1L), eq(101L), eq(5L), any(), any(), isNull()))
                .thenReturn(List.of(existing));

        TeachingAssignmentRequest request = new TeachingAssignmentRequest(
                1L, 101L, 5L, AssignmentRole.MAIN,
                LocalDate.of(2026, 10, 20), LocalDate.of(2026, 11, 30)
        );

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                classSetupService.createTeachingAssignment(request));
        assertTrue(ex.getMessage().contains("trùng lặp"));
    }

    @Test
    @DisplayName("Chặn phân công khi effectiveFrom sau effectiveTo")
    void createTeachingAssignment_FailsWhenEffectiveFromAfterTo() {
        mockClass.setProgramId(10L);
        when(trainingClassRepository.findById(1L)).thenReturn(Optional.of(mockClass));
        when(programSubjectRepository.findById(101L)).thenReturn(Optional.of(mockProgramSubject));
        when(userRepository.findById(5L)).thenReturn(Optional.of(mockTrainer));

        TeachingAssignmentRequest request = new TeachingAssignmentRequest(
                1L, 101L, 5L, AssignmentRole.MAIN,
                LocalDate.of(2026, 11, 30), LocalDate.of(2026, 10, 20)
        );

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                classSetupService.createTeachingAssignment(request));
        assertTrue(ex.getMessage().contains("không được sau"));
    }

    // =========================================================================
    // 3. Tests for updateTeachingAssignment
    // =========================================================================

    @Test
    @DisplayName("Chặn cập nhật thu hẹp hiệu lực nếu có buổi học đã xếp rơi ra ngoài")
    void updateTeachingAssignment_FailsWhenSessionFallsOutside() {
        TeachingAssignment existing = TeachingAssignment.builder()
                .id(501L)
                .classId(1L)
                .programSubjectId(101L)
                .trainerId(5L)
                .role(AssignmentRole.MAIN)
                .effectiveFrom(LocalDate.of(2026, 10, 1))
                .effectiveTo(LocalDate.of(2026, 12, 31))
                .isActive(true)
                .build();

        when(teachingAssignmentRepository.findById(501L)).thenReturn(Optional.of(existing));
        when(trainingClassRepository.findById(1L)).thenReturn(Optional.of(mockClass));
        when(userRepository.findById(5L)).thenReturn(Optional.of(mockTrainer));
        when(teachingAssignmentRepository.findOverlappingAssignments(eq(1L), eq(101L), eq(5L), any(), any(), eq(501L)))
                .thenReturn(Collections.emptyList());

        // Buổi học đã xếp ngày 2026-10-10
        Session session = Session.builder()
                .id(999L)
                .classId(1L)
                .trainerId(5L)
                .title("Java Core Session 1")
                .startTime(LocalDateTime.of(2026, 10, 10, 8, 0))
                .endTime(LocalDateTime.of(2026, 10, 10, 11, 30))
                .status(Session.SessionStatus.SCHEDULED)
                .build();
        when(sessionRepository.findByClassId(1L)).thenReturn(List.of(session));

        // Cố tình thu hẹp effectiveFrom lên ngày 2026-10-15 (khiến session 2026-10-10 bị rơi ra ngoài)
        UpdateTeachingAssignmentRequest request = new UpdateTeachingAssignmentRequest(
                5L, AssignmentRole.MAIN,
                LocalDate.of(2026, 10, 15), LocalDate.of(2026, 11, 30)
        );

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                classSetupService.updateTeachingAssignment(501L, request));
        assertTrue(ex.getMessage().contains("rơi ra ngoài khoảng thời gian hiệu lực mới"));
    }

    // =========================================================================
    // 4. Tests for available assignments for Danh
    // =========================================================================

    @Test
    @DisplayName("Lấy danh sách phân công còn hiệu lực tại một ngày cụ thể cho Danh")
    void getAvailableAssignments_ReturnsValidAssignments() {
        LocalDate queryDate = LocalDate.of(2026, 10, 25);
        when(trainingClassRepository.findById(1L)).thenReturn(Optional.of(mockClass));

        TeachingAssignment assignment = TeachingAssignment.builder()
                .id(501L)
                .classId(1L)
                .programSubjectId(101L)
                .trainerId(5L)
                .role(AssignmentRole.MAIN)
                .effectiveFrom(LocalDate.of(2026, 10, 20))
                .effectiveTo(LocalDate.of(2026, 11, 30))
                .isActive(true)
                .build();

        when(teachingAssignmentRepository.findAvailableAssignments(1L, queryDate))
                .thenReturn(List.of(assignment));
        when(programSubjectRepository.findAllById(any())).thenReturn(List.of(mockProgramSubject));
        when(subjectRepository.findAllById(any())).thenReturn(List.of(mockSubject));
        when(userRepository.findAllById(any())).thenReturn(List.of(mockTrainer));

        List<AvailableAssignmentResponse> responses = classSetupService.getAvailableAssignments(1L, queryDate);

        assertNotNull(responses);
        assertEquals(1, responses.size());
        assertEquals("JAVA_CORE", responses.get(0).subjectCode());
        assertEquals("Nguyen Van A", responses.get(0).trainerName());
    }
}
