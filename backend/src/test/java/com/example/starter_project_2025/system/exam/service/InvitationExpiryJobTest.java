package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.audit.InvitationAuditAction;
import com.example.starter_project_2025.system.exam.audit.InvitationAuditService;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.Invitation;
import com.example.starter_project_2025.system.exam.domain.InvitationRepository;
import com.example.starter_project_2025.system.exam.domain.InvitationStatus;
import com.example.starter_project_2025.system.exam.job.InvitationExpiryJob;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvitationExpiryJobTest {

    @Mock
    private InvitationRepository invitationRepository;

    @Mock
    private InvitationAuditService invitationAuditService;

    private InvitationExpiryJob job;

    @BeforeEach
    void setUp() {
        job = new InvitationExpiryJob(invitationRepository, invitationAuditService);
    }

    private Invitation invitation(InvitationStatus status, LocalDateTime expiresAt) {
        Exam exam = new Exam();
        exam.setId(1L);
        exam.setTitle("Kỳ thi");

        return Invitation.builder()
                .id(10L)
                .exam(exam)
                .status(status)
                .expiresAt(expiresAt)
                .build();
    }

    @Test
    @DisplayName("Lời mời SENT quá hạn cũng bị expire (chống bug query chỉ lấy PENDING)")
    void sentInvitationPastExpiryIsExpired() {
        Invitation sent = invitation(InvitationStatus.SENT, LocalDateTime.now().minusMinutes(5));
        when(invitationRepository.findAllExpiredPendingInvitations(any()))
                .thenReturn(List.of(sent));

        job.expireInvitations();

        assertEquals(InvitationStatus.EXPIRED, sent.getStatus());
        verify(invitationRepository).saveAll(List.of(sent));
    }

    @Test
    @DisplayName("Lời mời PENDING quá hạn bị expire")
    void pendingInvitationPastExpiryIsExpired() {
        Invitation pending = invitation(InvitationStatus.PENDING, LocalDateTime.now().minusMinutes(5));
        when(invitationRepository.findAllExpiredPendingInvitations(any()))
                .thenReturn(List.of(pending));

        job.expireInvitations();

        assertEquals(InvitationStatus.EXPIRED, pending.getStatus());
    }

    @Test
    @DisplayName("Ghi audit log EXPIRE cho mỗi lời mời bị expire")
    void auditLogRecordedForExpiredInvitations() {
        Invitation sent = invitation(InvitationStatus.SENT, LocalDateTime.now().minusMinutes(5));
        when(invitationRepository.findAllExpiredPendingInvitations(any()))
                .thenReturn(List.of(sent));

        job.expireInvitations();

        ArgumentCaptor<Invitation> captor = ArgumentCaptor.forClass(Invitation.class);
        verify(invitationAuditService).record(captor.capture(), org.mockito.ArgumentMatchers.eq(InvitationAuditAction.EXPIRE),
                org.mockito.ArgumentMatchers.isNull(), any());
        assertEquals(10L, captor.getValue().getId());
    }

    @Test
    @DisplayName("Không có lời mời quá hạn thì không ghi audit")
    void noExpiredInvitationNoAudit() {
        when(invitationRepository.findAllExpiredPendingInvitations(any())).thenReturn(List.of());

        job.expireInvitations();

        verify(invitationAuditService, never()).record(any(), any(), any(), any());
    }
}
