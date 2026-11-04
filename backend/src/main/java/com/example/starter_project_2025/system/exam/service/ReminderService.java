package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.ReminderDTO;
import com.example.starter_project_2025.system.exam.dto.ReminderRequest;
import com.example.starter_project_2025.system.notification.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReminderService {

    /** Số lần tối đa được thử gửi lại một reminder. */
    private static final int MAX_SEND_ATTEMPTS = 3;

    /** Cơ sở backoff (giây) giữa các lần thử lại. */
    private static final long RETRY_BACKOFF_SECONDS = 60L;

    private final ExamReminderRepository reminderRepository;
    private final InvitationRepository invitationRepository;
    private final ExamRepository examRepository;
    private final EmailService emailService;
    private final ExamAccessGuard examAccessGuard;

    @Transactional
    public List<ReminderDTO> scheduleReminder(Long examId, ReminderRequest request,
                                              UserPrincipal principal) {
        Exam exam = examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đề thi với id: " + examId));

        examAccessGuard.checkCanManage(exam, principal);

        LocalDateTime scheduledAt = resolveScheduledAt(exam, request);

        if (scheduledAt.isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Thời gian nhắc nhở phải nằm trong tương lai");
        }

        List<Invitation> targets;

        if (request.getInvitationId() != null) {
            Invitation invitation = invitationRepository.findById(request.getInvitationId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Invitation not found with id: " + request.getInvitationId()));

            if (!invitation.getExam().getId().equals(examId)) {
                throw new BadRequestException("Lời mời không thuộc đề thi này");
            }
            if (!isRemindable(invitation)) {
                throw new BadRequestException("Trạng thái lời mời không thể nhắc nhở: " + invitation.getStatus());
            }
            targets = List.of(invitation);
        } else {
            targets = invitationRepository.findByExamId(examId).stream()
                    .filter(this::isRemindable)
                    .toList();

            if (targets.isEmpty()) {
                throw new BadRequestException("Không tìm thấy lời mời nào có thể nhắc nhở cho đề thi này");
            }
        }

        List<ReminderDTO> created = new ArrayList<>();

        for (Invitation invitation : targets) {
            boolean duplicate = reminderRepository
                    .findActivePendingByInvitationId(invitation.getId()).stream()
                    .anyMatch(r -> r.getScheduledAt().equals(scheduledAt));

            if (duplicate) {
                continue;
            }

            ExamReminder reminder = ExamReminder.builder()
                    .exam(exam)
                    .invitation(invitation)
                    .reminderType(request.getReminderType())
                    .scheduledAt(scheduledAt)
                    .status(ReminderStatus.PENDING)
                    .sendAttempts(0)
                    .isActive(true)
                    .build();

            reminder = reminderRepository.save(reminder);
            created.add(toDTO(reminder));
        }

        if (created.isEmpty()) {
            throw new BadRequestException("Đã tồn tại nhắc nhở cùng thời điểm " + scheduledAt);
        }

        return created;
    }

    @Transactional(readOnly = true)
    public List<ReminderDTO> getRemindersByExam(Long examId, UserPrincipal principal) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đề thi với id: " + examId));
        examAccessGuard.checkCanManage(exam, principal);

        return reminderRepository.findByExamId(examId).stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public ReminderDTO getById(Long id, UserPrincipal principal) {
        ExamReminder reminder = reminderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhắc nhở với id: " + id));
        examAccessGuard.checkCanManage(reminder.getExam(), principal);

        return toDTO(reminder);
    }

    @Transactional
    public void cancelReminder(Long reminderId, UserPrincipal principal) {
        ExamReminder reminder = reminderRepository.findById(reminderId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhắc nhở với id: " + reminderId));

        examAccessGuard.checkCanManage(reminder.getExam(), principal);

        if (reminder.getStatus() == ReminderStatus.SENT) {
            throw new BadRequestException("Không thể huỷ nhắc nhở đã gửi");
        }

        reminder.setStatus(ReminderStatus.CANCELLED);
        reminder.setIsActive(false);
        reminder.setNextRetryAt(null);
        reminderRepository.save(reminder);
    }

    @Transactional
    public int sendPendingReminders() {
        LocalDateTime now = LocalDateTime.now();
        List<ExamReminder> due = new ArrayList<>(reminderRepository.findPendingRemindersToSend(now));
        due.addAll(reminderRepository.findRetryableReminders(now, MAX_SEND_ATTEMPTS));

        if (due.isEmpty()) {
            return 0;
        }

        int sent = 0;

        for (ExamReminder reminder : due) {
            Invitation invitation = reminder.getInvitation();

            if (invitation == null || !isRemindable(invitation)) {
                reminder.setStatus(ReminderStatus.CANCELLED);
                reminder.setIsActive(false);
                reminder.setLastError("Lời mời không còn nhận được nhắc nhở");
                reminderRepository.save(reminder);
                continue;
            }

            try {
                if (Boolean.TRUE.equals(invitation.getAnonymous())) {
                    emailService.sendExamReminderWithAccessCode(invitation, now);
                } else {
                    emailService.sendExamReminder(invitation, now);
                }

                reminder.setStatus(ReminderStatus.SENT);
                reminder.setSentAt(now);
                reminder.setSendAttempts(reminder.getSendAttempts() + 1);
                reminder.setLastError(null);
                reminder.setNextRetryAt(null);
                reminderRepository.save(reminder);
                sent++;
            } catch (Exception e) {
                int attempts = reminder.getSendAttempts() + 1;
                reminder.setSendAttempts(attempts);
                reminder.setLastError(e.getMessage());

                if (attempts < MAX_SEND_ATTEMPTS) {
                    // Còn lượt thử lại: giữ PENDING và hẹn thời điểm thử lại (backoff).
                    reminder.setStatus(ReminderStatus.PENDING);
                    reminder.setIsActive(true);
                    reminder.setNextRetryAt(now.plusSeconds(RETRY_BACKOFF_SECONDS * attempts));
                } else {
                    reminder.setStatus(ReminderStatus.FAILED);
                    reminder.setIsActive(false);
                    reminder.setNextRetryAt(null);
                }

                reminderRepository.save(reminder);
                log.error("Failed to send reminder id={} (attempt {}/{}): {}",
                        reminder.getId(), attempts, MAX_SEND_ATTEMPTS, e.getMessage());
            }
        }

        log.info("Sent {} out of {} due reminders", sent, due.size());
        return sent;
    }

    private LocalDateTime resolveScheduledAt(Exam exam, ReminderRequest request) {
        if (request.getReminderType() == ReminderType.CUSTOM) {
            if (request.getScheduledAt() == null) {
                throw new BadRequestException("Cần có scheduledAt cho nhắc nhở tùy chỉnh");
            }
            return request.getScheduledAt();
        }

        if (exam.getStartTime() == null) {
                throw new BadRequestException("Đề thi chưa có thời gian bắt đầu, không thể tự động đặt nhắc nhở");
        }

        return switch (request.getReminderType()) {
            case ONE_HOUR -> exam.getStartTime().minusHours(1);
            case ONE_DAY -> exam.getStartTime().minusDays(1);
            case CUSTOM -> request.getScheduledAt();
        };
    }

    private boolean isRemindable(Invitation invitation) {
        if (invitation.getStatus() == InvitationStatus.REVOKED
                || invitation.getStatus() == InvitationStatus.EXPIRED
                || invitation.getStatus() == InvitationStatus.REJECTED) {
            return false;
        }
        if (!Boolean.TRUE.equals(invitation.getIsActive())) {
            return false;
        }
        if (invitation.getExpiresAt() != null && LocalDateTime.now().isAfter(invitation.getExpiresAt())) {
            return false;
        }
        return Boolean.TRUE.equals(invitation.getAnonymous())
                ? invitation.getGuestEmail() != null && !invitation.getGuestEmail().isBlank()
                : invitation.getUser() != null;
    }

    private ReminderDTO toDTO(ExamReminder reminder) {
        ReminderDTO dto = new ReminderDTO();
        dto.setId(reminder.getId());
        dto.setIsActive(reminder.getIsActive());
        dto.setCreatedAt(reminder.getCreatedAt());
        dto.setUpdatedAt(reminder.getUpdatedAt());
        dto.setCreatedBy(reminder.getCreatedBy());
        dto.setUpdatedBy(reminder.getUpdatedBy());

        dto.setExamId(reminder.getExam() != null ? reminder.getExam().getId() : null);
        dto.setExamTitle(reminder.getExam() != null ? reminder.getExam().getTitle() : null);

        Invitation invitation = reminder.getInvitation();
        dto.setInvitationId(invitation != null ? invitation.getId() : null);
        dto.setUserEmail(invitation != null
                ? (invitation.getUser() != null ? invitation.getUser().getEmail() : invitation.getGuestEmail())
                : null);
        dto.setUserFullName(invitation != null
                ? (invitation.getUser() != null ? invitation.getUser().getFullName() : invitation.getGuestName())
                : null);

        dto.setReminderType(reminder.getReminderType());
        dto.setScheduledAt(reminder.getScheduledAt());
        dto.setSentAt(reminder.getSentAt());
        dto.setStatus(reminder.getStatus());
        dto.setSendAttempts(reminder.getSendAttempts());
        dto.setLastError(reminder.getLastError());
        dto.setNextRetryAt(reminder.getNextRetryAt());

        return dto;
    }
}