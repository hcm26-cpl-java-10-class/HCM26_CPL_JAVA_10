package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamReminder;
import com.example.starter_project_2025.system.exam.domain.ExamReminderRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.Invitation;
import com.example.starter_project_2025.system.exam.domain.InvitationRepository;
import com.example.starter_project_2025.system.exam.domain.InvitationStatus;
import com.example.starter_project_2025.system.exam.domain.ReminderStatus;
import com.example.starter_project_2025.system.exam.domain.ReminderType;
import com.example.starter_project_2025.system.exam.dto.ReminderDTO;
import com.example.starter_project_2025.system.exam.dto.ReminderRequest;
import com.example.starter_project_2025.system.notification.service.EmailService;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReminderServiceTest {

    @Mock
    private ExamReminderRepository reminderRepository;

    @Mock
    private InvitationRepository invitationRepository;

    @Mock
    private ExamRepository examRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private ExamAccessGuard examAccessGuard;

    private ReminderService service;

    @BeforeEach
    void setUp() {
        service = new ReminderService(
                reminderRepository, invitationRepository, examRepository, emailService, examAccessGuard);
    }

    private Exam exam() {
        Exam exam = new Exam();
        exam.setId(1L);
        exam.setTitle("Kỳ thi");
        exam.setDurationMinutes(60);
        exam.setIsActive(true);
        exam.setCreatedBy(1L);
        return exam;
    }

    private Invitation invitation(Long id, InvitationStatus status) {
        User user = User.builder().id(id).email("sv" + id + "@example.com").firstName("SV").build();
        return Invitation.builder()
                .id(id)
                .exam(exam())
                .user(user)
                .status(status)
                .expiresAt(LocalDateTime.now().plusDays(3))
                .build();
    }

    private ReminderRequest request(ReminderType type, Long invitationId) {
        ReminderRequest req = new ReminderRequest();
        req.setReminderType(type);
        req.setInvitationId(invitationId);
        return req;
    }

    @Test
    @DisplayName("Đặt nhắc nhở cho 1 lời mời cụ thể thì chỉ tạo 1 reminder gắn đúng lời mời đó")
    void reminderForSingleInvitationOnlyCreatesOne() {
        Exam exam = exam();
        Invitation target = invitation(100L, InvitationStatus.SENT);

        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(invitationRepository.findById(100L)).thenReturn(Optional.of(target));
        when(reminderRepository.findActivePendingByInvitationId(100L)).thenReturn(List.of());
        when(reminderRepository.save(any(ExamReminder.class))).thenAnswer(inv -> inv.getArgument(0));

        List<ReminderDTO> result = service.scheduleReminder(
                1L, request(ReminderType.ONE_HOUR, 100L), null);

        assertEquals(1, result.size());
        assertEquals(100L, result.get(0).getInvitationId());

        ArgumentCaptor<ExamReminder> captor = ArgumentCaptor.forClass(ExamReminder.class);
        verify(reminderRepository).save(captor.capture());
        assertEquals(100L, captor.getValue().getInvitation().getId());
    }

    @Test
    @DisplayName("Đặt nhắc nhở cả đề thì tạo reminder cho mọi lời mời nhận được nhắc")
    void examWideReminderCoversAllRemindableInvitations() {
        Exam exam = exam();
        Invitation first = invitation(100L, InvitationStatus.SENT);
        Invitation second = invitation(200L, InvitationStatus.ACCEPTED);
        Invitation revoked = invitation(300L, InvitationStatus.REVOKED);

        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(invitationRepository.findByExamId(1L)).thenReturn(List.of(first, second, revoked));
        when(reminderRepository.findActivePendingByInvitationId(any())).thenReturn(List.of());
        when(reminderRepository.save(any(ExamReminder.class))).thenAnswer(inv -> inv.getArgument(0));

        List<ReminderDTO> result = service.scheduleReminder(
                1L, request(ReminderType.ONE_DAY, null), null);

        assertEquals(2, result.size());
    }

    @Test
    @DisplayName("Trùng lịch nhắc nhở cùng thời điểm thì bị từ chối")
    void duplicateReminderRejected() {
        Exam exam = exam();
        Invitation target = invitation(100L, InvitationStatus.SENT);
        // Exam khong con gio bat dau, moc nhac nhay theo han cua loi moi.
        LocalDateTime scheduledAt = target.getExpiresAt().minusHours(1);

        ExamReminder existing = ExamReminder.builder()
                .id(1L)
                .exam(exam)
                .invitation(target)
                .reminderType(ReminderType.ONE_HOUR)
                .scheduledAt(scheduledAt)
                .status(ReminderStatus.PENDING)
                .isActive(true)
                .build();

        when(examRepository.findById(1L)).thenReturn(Optional.of(exam));
        when(invitationRepository.findById(100L)).thenReturn(Optional.of(target));
        when(reminderRepository.findActivePendingByInvitationId(100L)).thenReturn(List.of(existing));

        assertThrows(BadRequestException.class, () -> service.scheduleReminder(
                1L, request(ReminderType.ONE_HOUR, 100L), null));
    }

    @Test
    @DisplayName("Gửi nhắc nhở thành công thì chuyển sang SENT")
    void sendingReminderMarksSent() {
        Invitation target = invitation(100L, InvitationStatus.SENT);
        ExamReminder reminder = ExamReminder.builder()
                .id(1L)
                .exam(target.getExam())
                .invitation(target)
                .reminderType(ReminderType.ONE_HOUR)
                .scheduledAt(LocalDateTime.now().minusMinutes(1))
                .status(ReminderStatus.PENDING)
                .sendAttempts(0)
                .isActive(true)
                .build();

        when(reminderRepository.findPendingRemindersToSend(any())).thenReturn(List.of(reminder));
        when(reminderRepository.findRetryableReminders(any(), any(Integer.class))).thenReturn(List.of());

        int sent = service.sendPendingReminders();

        assertEquals(1, sent);
        assertEquals(ReminderStatus.SENT, reminder.getStatus());
        assertNull(reminder.getLastError());
        verify(emailService).sendExamReminder(org.mockito.ArgumentMatchers.eq(target), any());
    }

    @Test
    @DisplayName("Gửi lỗi thì giữ PENDING và hẹn thử lại (backoff), chưa chuyển FAILED")
    void failedReminderIsRetriedWithBackoff() {
        Invitation target = invitation(100L, InvitationStatus.SENT);
        ExamReminder reminder = ExamReminder.builder()
                .id(1L)
                .exam(target.getExam())
                .invitation(target)
                .reminderType(ReminderType.ONE_HOUR)
                .scheduledAt(LocalDateTime.now().minusMinutes(1))
                .status(ReminderStatus.PENDING)
                .sendAttempts(0)
                .isActive(true)
                .build();

        when(reminderRepository.findPendingRemindersToSend(any())).thenReturn(List.of(reminder));
        when(reminderRepository.findRetryableReminders(any(), any(Integer.class))).thenReturn(List.of());
        org.mockito.Mockito.doThrow(new RuntimeException("SMTP lỗi"))
                .when(emailService).sendExamReminder(org.mockito.ArgumentMatchers.eq(target), any());

        int sent = service.sendPendingReminders();

        assertEquals(0, sent);
        assertEquals(ReminderStatus.PENDING, reminder.getStatus());
        assertEquals(1, reminder.getSendAttempts());
        assertNotNull(reminder.getNextRetryAt());
        assertTrue(reminder.getNextRetryAt().isAfter(LocalDateTime.now()));
    }

    @Test
    @DisplayName("Gửi lỗi đủ 3 lần thì mới chuyển FAILED")
    void reminderFailsAfterMaxAttempts() {
        Invitation target = invitation(100L, InvitationStatus.SENT);
        ExamReminder reminder = ExamReminder.builder()
                .id(1L)
                .exam(target.getExam())
                .invitation(target)
                .reminderType(ReminderType.ONE_HOUR)
                .scheduledAt(LocalDateTime.now().minusMinutes(1))
                .status(ReminderStatus.PENDING)
                .sendAttempts(2)
                .isActive(true)
                .build();

        when(reminderRepository.findPendingRemindersToSend(any())).thenReturn(List.of());
        when(reminderRepository.findRetryableReminders(any(), any(Integer.class))).thenReturn(List.of(reminder));
        org.mockito.Mockito.doThrow(new RuntimeException("SMTP lỗi"))
                .when(emailService).sendExamReminder(org.mockito.ArgumentMatchers.eq(target), any());

        service.sendPendingReminders();

        assertEquals(ReminderStatus.FAILED, reminder.getStatus());
        assertEquals(3, reminder.getSendAttempts());
        assertNull(reminder.getNextRetryAt());
        assertEquals(Boolean.FALSE, reminder.getIsActive());
    }

    @Test
    @DisplayName("Huỷ nhắc nhở PENDING thì chuyển CANCELLED")
    void cancelPendingReminder() {
        ExamReminder reminder = ExamReminder.builder()
                .id(1L)
                .exam(exam())
                .invitation(invitation(100L, InvitationStatus.SENT))
                .reminderType(ReminderType.ONE_HOUR)
                .scheduledAt(LocalDateTime.now().plusHours(1))
                .status(ReminderStatus.PENDING)
                .isActive(true)
                .build();

        when(reminderRepository.findById(1L)).thenReturn(Optional.of(reminder));

        service.cancelReminder(1L, null);

        assertEquals(ReminderStatus.CANCELLED, reminder.getStatus());
        assertEquals(Boolean.FALSE, reminder.getIsActive());
    }

    @Test
    @DisplayName("Không huỷ được nhắc nhở đã gửi")
    void sentReminderCannotBeCancelled() {
        ExamReminder reminder = ExamReminder.builder()
                .id(1L)
                .exam(exam())
                .invitation(invitation(100L, InvitationStatus.SENT))
                .reminderType(ReminderType.ONE_HOUR)
                .scheduledAt(LocalDateTime.now().minusHours(1))
                .status(ReminderStatus.SENT)
                .isActive(true)
                .build();

        when(reminderRepository.findById(1L)).thenReturn(Optional.of(reminder));

        assertThrows(BadRequestException.class, () -> service.cancelReminder(1L, null));
        verify(reminderRepository, never()).save(any(ExamReminder.class));
    }

    @Test
    @DisplayName("Lời mời không còn nhận được nhắc thì reminder bị CANCELLED")
    void reminderForUnremindableInvitationIsCancelled() {
        Invitation revoked = invitation(100L, InvitationStatus.REVOKED);
        ExamReminder reminder = ExamReminder.builder()
                .id(1L)
                .exam(revoked.getExam())
                .invitation(revoked)
                .reminderType(ReminderType.ONE_HOUR)
                .scheduledAt(LocalDateTime.now().minusMinutes(1))
                .status(ReminderStatus.PENDING)
                .sendAttempts(0)
                .isActive(true)
                .build();

        when(reminderRepository.findPendingRemindersToSend(any())).thenReturn(List.of(reminder));
        when(reminderRepository.findRetryableReminders(any(), any(Integer.class))).thenReturn(List.of());

        int sent = service.sendPendingReminders();

        assertEquals(0, sent);
        assertEquals(ReminderStatus.CANCELLED, reminder.getStatus());
        verify(emailService, never()).sendExamReminder(any(), any());
    }

    @Test
    @DisplayName("Reminder ẩn danh dùng đúng hàm gửi kèm mã truy cập")
    void anonymousReminderUsesAccessCodeEmail() {
        Invitation anon = Invitation.builder()
                .id(100L)
                .exam(exam())
                .anonymous(true)
                .guestName("Khách")
                .guestEmail("guest@example.com")
                .status(InvitationStatus.SENT)
                .accessCode("ABCD1234")
                .expiresAt(LocalDateTime.now().plusDays(3))
                .build();

        ExamReminder reminder = ExamReminder.builder()
                .id(1L)
                .exam(anon.getExam())
                .invitation(anon)
                .reminderType(ReminderType.ONE_HOUR)
                .scheduledAt(LocalDateTime.now().minusMinutes(1))
                .status(ReminderStatus.PENDING)
                .sendAttempts(0)
                .isActive(true)
                .build();

        when(reminderRepository.findPendingRemindersToSend(any())).thenReturn(List.of(reminder));
        when(reminderRepository.findRetryableReminders(any(), any(Integer.class))).thenReturn(List.of());

        service.sendPendingReminders();

        verify(emailService).sendExamReminderWithAccessCode(org.mockito.ArgumentMatchers.eq(anon), any());
        verify(emailService, times(1)).sendExamReminderWithAccessCode(any(), any());
    }
}
