package com.example.starter_project_2025.system.invitation.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.invitation.audit.InvitationAuditService;
import com.example.starter_project_2025.system.invitation.domain.Invitation;
import com.example.starter_project_2025.system.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.invitation.domain.InvitationStatus;
import com.example.starter_project_2025.system.invitation.dto.*;
import com.example.starter_project_2025.system.invitation.mapper.InvitationMapper;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvitationActionServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private InvitationRepository invitationRepository;

    @Mock
    private InvitationMapper invitationMapper;

    @Mock
    private InvitationValidator invitationValidator;

    @Mock
    private InvitationAuditService auditService;

    @Mock
    private InvitationBatchItemProcessor batchItemProcessor;

    @InjectMocks
    private InvitationActionService actionService;

    private Exam exam;
    private User user;
    private Invitation invitation;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "teacher@example.com",
                        "password",
                        List.of(
                                new SimpleGrantedAuthority("INVITATION_READ"),
                                new SimpleGrantedAuthority("INVITATION_CREATE"),
                                new SimpleGrantedAuthority("INVITATION_UPDATE"),
                                new SimpleGrantedAuthority("INVITATION_DELETE")
                        )
                )
        );

        exam = new Exam();
        exam.setId(1L);
        exam.setTitle("Thi Cuoi Ky");
        exam.setIsActive(true);

        user = new User();
        user.setId(2L);
        user.setEmail("student@example.com");
        user.setFirstName("Nguyen Van");
        user.setLastName("An");
        user.setIsActive(true);

        invitation = Invitation.builder()
                .id(100L)
                .exam(exam)
                .user(user)
                .status(InvitationStatus.PENDING)
                .resendCount(0)
                .isActive(true)
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("inviteSingle creates invitation successfully and logs audit")
    void inviteSingle_Success() {
        InvitationDTO request = new InvitationDTO();
        request.setExamId(1L);
        request.setUserId(2L);

        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(invitationRepository.saveAndFlush(any(Invitation.class))).thenReturn(invitation);
        when(invitationMapper.toResponse(invitation)).thenReturn(request);

        InvitationDTO response = actionService.inviteSingle(request);

        assertNotNull(response);
        verify(invitationValidator).validateForCreate(eq(request), any(ValidationContext.class));
        verify(invitationRepository).saveAndFlush(any(Invitation.class));
        verify(batchItemProcessor).sendEmailNotificationSafely(user, exam);
        verify(auditService).log(eq(100L), eq(1L), eq(2L), eq("CREATE"), anyString());
    }

    @Test
    @DisplayName("inviteBatch processes items independently and skips duplicates in request")
    void inviteBatch_HandlesMixedItemsAndDuplicateInRequest() {
        BatchInvitationRequest request = BatchInvitationRequest.builder()
                .examId(1L)
                .userIds(List.of(2L, 3L, 2L)) // 2L bị trùng ngay trong request
                .build();

        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));

        BatchInvitationItemResult res1 = BatchInvitationItemResult.builder()
                .userId(2L)
                .status("SUCCESS")
                .reason("Tạo lời mời thành công")
                .invitationId(101L)
                .build();

        BatchInvitationItemResult res2 = BatchInvitationItemResult.builder()
                .userId(3L)
                .status("FAILED")
                .reason("Người dùng không tồn tại: ID 3")
                .build();

        when(batchItemProcessor.processItem(eq(exam), eq(2L), any(), any())).thenReturn(res1);
        when(batchItemProcessor.processItem(eq(exam), eq(3L), any(), any())).thenReturn(res2);

        BatchInvitationResponse response = actionService.inviteBatch(request);

        assertEquals(3, response.getTotalRequested());
        assertEquals(1, response.getSuccessCount());
        assertEquals(1, response.getSkippedCount());
        assertEquals(1, response.getFailedCount());
        assertEquals(3, response.getItems().size());
        assertEquals("SKIPPED", response.getItems().get(2).getStatus());
        assertEquals("Trùng ID trong yêu cầu", response.getItems().get(2).getReason());

        verify(auditService).log(isNull(), eq(1L), isNull(), eq("BATCH_CREATE"), anyString());
    }

    @Test
    @DisplayName("resend succeeds on PENDING status and increments resendCount")
    void resend_WhenPending_Succeeds() {
        when(invitationRepository.findById(100L)).thenReturn(Optional.of(invitation));
        when(invitationRepository.save(invitation)).thenReturn(invitation);
        InvitationDTO dto = new InvitationDTO();
        when(invitationMapper.toResponse(invitation)).thenReturn(dto);

        InvitationDTO result = actionService.resend(100L);

        assertNotNull(result);
        assertEquals(1, invitation.getResendCount());
        assertNotNull(invitation.getSentAt());
        verify(invitationRepository).save(invitation);
        verify(auditService).log(eq(100L), eq(1L), eq(2L), eq("RESEND"), anyString());
    }

    @Test
    @DisplayName("resend rejects when invitation is REVOKED or ACCEPTED")
    void resend_WhenNotPending_ThrowsException() {
        invitation.setStatus(InvitationStatus.REVOKED);
        when(invitationRepository.findById(100L)).thenReturn(Optional.of(invitation));

        assertThrows(BusinessValidationException.class, () -> actionService.resend(100L));
        verify(invitationRepository, never()).save(any());
    }

    @Test
    @DisplayName("revoke succeeds on PENDING and updates status to REVOKED")
    void revoke_WhenPending_Succeeds() {
        when(invitationRepository.findById(100L)).thenReturn(Optional.of(invitation));
        when(invitationRepository.save(invitation)).thenReturn(invitation);
        InvitationDTO dto = new InvitationDTO();
        when(invitationMapper.toResponse(invitation)).thenReturn(dto);

        RevokeInvitationRequest req = new RevokeInvitationRequest("Học sinh chuyển lớp");
        InvitationDTO result = actionService.revoke(100L, req);

        assertNotNull(result);
        assertEquals(InvitationStatus.REVOKED, invitation.getStatus());
        assertEquals("Học sinh chuyển lớp", invitation.getRevokedReason());
        assertNotNull(invitation.getRevokedAt());
        verify(invitationRepository).save(invitation);
        verify(auditService).log(eq(100L), eq(1L), eq(2L), eq("REVOKE"), contains("Học sinh chuyển lớp"));
    }

    @Test
    @DisplayName("revoke rejects when invitation is already REVOKED")
    void revoke_WhenAlreadyRevoked_ThrowsException() {
        invitation.setStatus(InvitationStatus.REVOKED);
        when(invitationRepository.findById(100L)).thenReturn(Optional.of(invitation));

        assertThrows(BusinessValidationException.class, () -> actionService.revoke(100L, null));
        verify(invitationRepository, never()).save(any());
    }

    @Test
    @DisplayName("student can accept own pending invitation")
    void acceptInvitation_WhenPendingAndOwned_Succeeds() {
        invitation.setExpiresAt(java.time.LocalDateTime.now().plusHours(1));
        when(invitationRepository.lockById(100L)).thenReturn(Optional.of(invitation));
        when(invitationRepository.save(invitation)).thenReturn(invitation);
        InvitationDTO dto = new InvitationDTO();
        when(invitationMapper.toResponse(invitation)).thenReturn(dto);

        InvitationDTO result = actionService.acceptInvitation(100L, 2L);

        assertSame(dto, result);
        assertEquals(InvitationStatus.ACCEPTED, invitation.getStatus());
        verify(invitationRepository).save(invitation);
    }

    @Test
    @DisplayName("student cannot accept another user's invitation")
    void acceptInvitation_WhenNotOwned_HidesInvitation() {
        when(invitationRepository.lockById(100L)).thenReturn(Optional.of(invitation));

        assertThrows(ResourceNotFoundException.class, () -> actionService.acceptInvitation(100L, 999L));
        verify(invitationRepository, never()).save(any());
    }

    @Test
    @DisplayName("student cannot accept an expired invitation")
    void acceptInvitation_WhenExpired_Rejects() {
        invitation.setExpiresAt(java.time.LocalDateTime.now().minusMinutes(1));
        when(invitationRepository.lockById(100L)).thenReturn(Optional.of(invitation));

        assertThrows(BadRequestException.class, () -> actionService.acceptInvitation(100L, 2L));
        verify(invitationRepository, never()).save(any());
    }

    @Test
    @DisplayName("Missing authority throws AccessDeniedException")
    void checkPermission_WhenMissingAuthority_ThrowsAccessDenied() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "student@example.com",
                        "password",
                        List.of(new SimpleGrantedAuthority("INVITATION_READ"))
                )
        );

        InvitationDTO req = new InvitationDTO();
        req.setExamId(1L);
        req.setUserId(2L);

        assertThrows(AccessDeniedException.class, () -> actionService.inviteSingle(req));
    }
}
