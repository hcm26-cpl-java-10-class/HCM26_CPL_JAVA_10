package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.audit.InvitationAuditAction;
import com.example.starter_project_2025.system.exam.audit.InvitationAuditService;
import com.example.starter_project_2025.system.exam.domain.AnonymousSessionRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamReminder;
import com.example.starter_project_2025.system.exam.domain.ExamReminderRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.Invitation;
import com.example.starter_project_2025.system.exam.domain.InvitationRepository;
import com.example.starter_project_2025.system.exam.domain.InvitationStatus;
import com.example.starter_project_2025.system.exam.dto.BatchInvitationRequest;
import com.example.starter_project_2025.system.exam.dto.BatchInvitationResponse;
import com.example.starter_project_2025.system.exam.dto.InvitationCreateRequest;
import com.example.starter_project_2025.system.exam.dto.InvitationDTO;
import com.example.starter_project_2025.system.notification.service.EmailService;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvitationServiceTest {

    private static final Long TEACHER_ID = 10L;

    @Mock
    private InvitationRepository invitationRepository;

    @Mock
    private AnonymousSessionRepository anonymousSessionRepository;

    @Mock
    private ExamRepository examRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private GuestUserService guestUserService;

    @Mock
    private ExamAccessGuard examAccessGuard;

    @Mock
    private InvitationAuditService invitationAuditService;

    @Mock
    private ExamReminderRepository examReminderRepository;

    private InvitationService service;

    private Exam exam;
    private User student;

    @BeforeEach
    void setUp() {
        service = new InvitationService(
                invitationRepository,
                anonymousSessionRepository,
                examRepository,
                userRepository,
                emailService,
                guestUserService,
                examAccessGuard,
                invitationAuditService,
                examReminderRepository);

        exam = new Exam();
        exam.setId(1L);
        exam.setTitle("Kỳ thi giữa kỳ");
        exam.setDurationMinutes(60);
        exam.setStartTime(LocalDateTime.now().plusDays(1));
        exam.setEndTime(LocalDateTime.now().plusDays(2));
        exam.setIsActive(true);
        exam.setCreatedBy(TEACHER_ID);

        student = User.builder()
                .id(100L)
                .email("sv@example.com")
                .firstName("Nguyen")
                .lastName("A")
                .build();

        lenient().when(invitationRepository.save(any(Invitation.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(invitationRepository.existsByAccessCode(anyString())).thenReturn(false);
    }

    private UserPrincipal teacherPrincipal() {
        User teacher = User.builder()
                .id(TEACHER_ID)
                .email("gv@example.com")
                .firstName("Giao")
                .passwordHash("x")
                .isActive(true)
                .locked(false)
                .build();
        Set<Role> roles = new HashSet<>();
        roles.add(Role.builder().name("TEACHER").build());
        teacher.setRoles(roles);
        return new UserPrincipal(teacher, List.of(new SimpleGrantedAuthority("ROLE_TEACHER")));
    }

    private InvitationCreateRequest createRequest(Long userId) {
        InvitationCreateRequest request = new InvitationCreateRequest();
        request.setUserId(userId);
        return request;
    }

    @Test
    @DisplayName("Tạo lời mời thành công thì chuyển sang SENT và gửi email")
    void createInvitationSendsEmailAndMarksSent() {
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(userRepository.findById(100L)).thenReturn(Optional.of(student));
        when(invitationRepository.existsByExamIdAndUserId(1L, 100L)).thenReturn(false);

        InvitationDTO dto = service.createInvitation(1L, createRequest(100L), teacherPrincipal());

        assertEquals(InvitationStatus.SENT, dto.getStatus());
        assertNotNull(dto.getSentAt());
        verify(emailService).sendExamInvitation(any(Invitation.class), org.mockito.ArgumentMatchers.eq(student));
    }

    @Test
    @DisplayName("Tạo lời mời cho người dùng đã có lời mời thì bị chặn")
    void duplicateInvitationRejected() {
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(userRepository.findById(100L)).thenReturn(Optional.of(student));
        when(invitationRepository.existsByExamIdAndUserId(1L, 100L)).thenReturn(true);

        assertThrows(BadRequestException.class,
                () -> service.createInvitation(1L, createRequest(100L), teacherPrincipal()));
        verify(emailService, never()).sendExamInvitation(any(), any());
    }

    @Test
    @DisplayName("Đề thi đã kết thúc thì không tạo được lời mời")
    void invitationBlockedForFinishedExam() {
        exam.setEndTime(LocalDateTime.now().minusDays(1));
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createInvitation(1L, createRequest(100L), teacherPrincipal()));
        assertEquals("Kỳ thi đã kết thúc, không thể mời tham dự", ex.getMessage());
    }

    @Test
    @DisplayName("expiresAt nằm trong quá khứ thì bị chặn")
    void expiresAtInPastRejected() {
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(userRepository.findById(100L)).thenReturn(Optional.of(student));
        when(invitationRepository.existsByExamIdAndUserId(1L, 100L)).thenReturn(false);

        InvitationCreateRequest request = createRequest(100L);
        request.setExpiresAt(LocalDateTime.now().minusDays(1).toString());

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createInvitation(1L, request, teacherPrincipal()));
        assertTrue(ex.getMessage().contains("quá khứ"));
    }

    @Test
    @DisplayName("expiresAt vượt quá thời gian kết thúc đề thì bị chặn")
    void expiresAtAfterExamEndRejected() {
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(userRepository.findById(100L)).thenReturn(Optional.of(student));
        when(invitationRepository.existsByExamIdAndUserId(1L, 100L)).thenReturn(false);

        InvitationCreateRequest request = createRequest(100L);
        request.setExpiresAt(LocalDateTime.now().plusDays(10).toString());

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.createInvitation(1L, request, teacherPrincipal()));
        assertTrue(ex.getMessage().contains("vượt quá"));
    }

    @Test
    @DisplayName("Batch với sendEmail=false thì không gửi mail và lời mời ở trạng thái PENDING")
    void batchWithoutEmailKeepsPending() {
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(userRepository.findById(100L)).thenReturn(Optional.of(student));
        when(invitationRepository.existsByExamIdAndUserId(1L, 100L)).thenReturn(false);

        BatchInvitationRequest request = new BatchInvitationRequest();
        request.setInvitations(List.of(createRequest(100L)));
        request.setSendEmail(false);

        BatchInvitationResponse response = service.createBatchInvitations(1L, request, teacherPrincipal());

        assertEquals(1, response.getSuccessCount());
        assertEquals(InvitationStatus.PENDING,
                response.getSuccessfulInvitations().get(0).getStatus());
        verify(emailService, never()).sendExamInvitation(any(), any());
        verify(invitationAuditService).record(
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.eq(InvitationAuditAction.BATCH_CREATE),
                org.mockito.ArgumentMatchers.eq(TEACHER_ID),
                anyString());
    }

    @Test
    @DisplayName("Gửi lại lời mời đã ACCEPTED thì giữ nguyên trạng thái ACCEPTED")
    void resendKeepsAcceptedStatus() {
        Invitation invitation = Invitation.builder()
                .id(50L)
                .exam(exam)
                .user(student)
                .status(InvitationStatus.ACCEPTED)
                .resendCount(0)
                .expiresAt(LocalDateTime.now().plusDays(1))
                .build();

        when(invitationRepository.findById(50L)).thenReturn(Optional.of(invitation));

        InvitationDTO dto = service.resendInvitation(50L, teacherPrincipal());

        assertEquals(InvitationStatus.ACCEPTED, dto.getStatus());
        assertEquals(1, dto.getResendCount());
        verify(emailService).sendExamInvitation(any(Invitation.class), org.mockito.ArgumentMatchers.eq(student));
    }

    @Test
    @DisplayName("Gửi lại lời mời đang SENT thì vẫn SENT và tăng số lần gửi lại")
    void resendKeepsSentStatus() {
        Invitation invitation = Invitation.builder()
                .id(50L)
                .exam(exam)
                .user(student)
                .status(InvitationStatus.SENT)
                .resendCount(2)
                .expiresAt(LocalDateTime.now().plusDays(1))
                .build();

        when(invitationRepository.findById(50L)).thenReturn(Optional.of(invitation));

        InvitationDTO dto = service.resendInvitation(50L, teacherPrincipal());

        assertEquals(InvitationStatus.SENT, dto.getStatus());
        assertEquals(3, dto.getResendCount());
    }

    @Test
    @DisplayName("Thu hồi lời mời thì chuyển REVOKED và ghi audit")
    void revokeMarksRevokedAndWritesAudit() {
        Invitation invitation = Invitation.builder()
                .id(50L)
                .exam(exam)
                .user(student)
                .status(InvitationStatus.SENT)
                .expiresAt(LocalDateTime.now().plusDays(1))
                .build();

        when(invitationRepository.findById(50L)).thenReturn(Optional.of(invitation));

        InvitationDTO dto = service.revokeInvitation(50L, "Kỳ thi dời lịch", teacherPrincipal());

        assertEquals(InvitationStatus.REVOKED, dto.getStatus());
        verify(invitationAuditService).record(
                org.mockito.ArgumentMatchers.eq(invitation),
                org.mockito.ArgumentMatchers.eq(InvitationAuditAction.REVOKE),
                any(),
                anyString());
    }

    @Test
    @DisplayName("Xoá được lời mời PENDING và huỷ luôn reminder liên quan")
    void deletePendingInvitationCancelsReminders() {
        Invitation invitation = Invitation.builder()
                .id(50L)
                .exam(exam)
                .user(student)
                .status(InvitationStatus.PENDING)
                .expiresAt(LocalDateTime.now().plusDays(1))
                .build();

        ExamReminder reminder = ExamReminder.builder()
                .id(70L)
                .exam(exam)
                .invitation(invitation)
                .status(com.example.starter_project_2025.system.exam.domain.ReminderStatus.PENDING)
                .isActive(true)
                .build();

        when(invitationRepository.findById(50L)).thenReturn(Optional.of(invitation));
        when(examReminderRepository.findByInvitationId(50L)).thenReturn(List.of(reminder));

        service.deleteInvitation(50L, teacherPrincipal());

        assertEquals(
                com.example.starter_project_2025.system.exam.domain.ReminderStatus.CANCELLED,
                reminder.getStatus());
        assertEquals(Boolean.FALSE, reminder.getIsActive());
        verify(invitationRepository).delete(invitation);
        verify(invitationAuditService).record(
                org.mockito.ArgumentMatchers.eq(invitation),
                org.mockito.ArgumentMatchers.eq(InvitationAuditAction.DELETE),
                any(),
                anyString());
    }

    @Test
    @DisplayName("Không xoá được lời mời đã ACCEPTED hoặc COMPLETED")
    void acceptedOrCompletedInvitationCannotBeDeleted() {
        Invitation accepted = Invitation.builder()
                .id(50L)
                .exam(exam)
                .user(student)
                .status(InvitationStatus.ACCEPTED)
                .build();
        when(invitationRepository.findById(50L)).thenReturn(Optional.of(accepted));

        assertThrows(BadRequestException.class, () -> service.deleteInvitation(50L, teacherPrincipal()));
        verify(invitationRepository, never()).delete(any(Invitation.class));

        Invitation completed = Invitation.builder()
                .id(51L)
                .exam(exam)
                .user(student)
                .status(InvitationStatus.COMPLETED)
                .build();
        when(invitationRepository.findById(51L)).thenReturn(Optional.of(completed));

        assertThrows(BadRequestException.class, () -> service.deleteInvitation(51L, teacherPrincipal()));
    }

    @Test
    @DisplayName("Giáo viên không phải chủ đề thi bị chặn khi xem lời mời")
    void nonOwnerTeacherBlockedFromListingInvitations() {
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        org.mockito.Mockito.doThrow(new BadRequestException("Bạn không có quyền quản lý lời mời của đề thi này"))
                .when(examAccessGuard).checkCanManage(org.mockito.ArgumentMatchers.eq(exam), any());

        assertThrows(BadRequestException.class, () -> service.getInvitationsByExam(
                1L, new com.example.starter_project_2025.system.exam.dto.InvitationFilter(), teacherPrincipal()));
    }

    @Test
    @DisplayName("accessCode được mask (null) với giáo viên không phải người tạo lời mời")
    void accessCodeMaskedForNonCreator() {
        Invitation invitation = Invitation.builder()
                .id(50L)
                .exam(exam)
                .anonymous(true)
                .guestName("Khách")
                .accessCode("ABCD1234")
                .status(InvitationStatus.SENT)
                .expiresAt(LocalDateTime.now().plusDays(1))
                .build();
        // createdBy khác giáo viên hiện tại
        invitation.setCreatedBy(999L);

        when(invitationRepository.findById(50L)).thenReturn(Optional.of(invitation));
        when(examAccessGuard.isAdmin(any())).thenReturn(false);

        InvitationDTO dto = service.getById(50L, teacherPrincipal());

        assertFalse(dto.getAccessCode() != null, "accessCode phải được mask");
    }

    @Test
    @DisplayName("Sinh mã truy cập phải là duy nhất (kiểm tra existsByAccessCode)")
    void accessCodeGenerationAvoidsDuplicates() {
        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(invitationRepository.existsByAccessCode(anyString())).thenReturn(true, false);

        service.createAnonymousInvitation(1L, new com.example.starter_project_2025.system.exam.dto.AnonymousInvitationRequest(),
                teacherPrincipal());

        // Vòng lặp phải hỏi lại DB ít nhất 2 lần: lần đầu trùng, lần sau mới dùng.
        verify(invitationRepository, org.mockito.Mockito.atLeast(2)).existsByAccessCode(anyString());
    }
}
