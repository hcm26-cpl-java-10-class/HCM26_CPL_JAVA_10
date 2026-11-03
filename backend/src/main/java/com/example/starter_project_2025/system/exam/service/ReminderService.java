package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
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

    private final ExamReminderRepository reminderRepository;
    private final InvitationRepository invitationRepository;
    private final ExamRepository examRepository;
    private final EmailService emailService;

    @Transactional
    public List<ReminderDTO> scheduleReminder(Long examId, ReminderRequest request) {
        Exam exam = examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found with id: " + examId));

        LocalDateTime scheduledAt = resolveScheduledAt(exam, request);

        if (scheduledAt.isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Reminder time must be in the future");
        }

        List<Invitation> targets;

        if (request.getInvitationId() != null) {
            Invitation invitation = invitationRepository.findById(request.getInvitationId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Invitation not found with id: " + request.getInvitationId()));

            if (!invitation.getExam().getId().equals(examId)) {
                throw new BadRequestException("Invitation does not belong to this exam");
            }
            if (!isRemindable(invitation)) {
                throw new BadRequestException("Invitation status is not remindable: " + invitation.getStatus());
            }
            targets = List.of(invitation);
        } else {
            targets = invitationRepository.findByExamId(examId).stream()
                    .filter(this::isRemindable)
                    .toList();

            if (targets.isEmpty()) {
                throw new BadRequestException("No remindable invitations found for this exam");
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
            throw new BadRequestException("Duplicate reminder already scheduled at " + scheduledAt);
        }

        return created;
    }

    @Transactional(readOnly = true)
    public List<ReminderDTO> getRemindersByExam(Long examId) {
        return reminderRepository.findByExamId(examId).stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public ReminderDTO getById(Long id) {
        return toDTO(reminderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found with id: " + id)));
    }

    @Transactional
    public void cancelReminder(Long reminderId) {
        ExamReminder reminder = reminderRepository.findById(reminderId)
                .orElseThrow(() -> new ResourceNotFoundException("Reminder not found with id: " + reminderId));

        if (reminder.getStatus() == ReminderStatus.SENT) {
            throw new BadRequestException("Cannot cancel a reminder that has already been sent");
        }

        reminder.setStatus(ReminderStatus.CANCELLED);
        reminder.setIsActive(false);
        reminderRepository.save(reminder);
    }

    @Transactional
    public int sendPendingReminders() {
        LocalDateTime now = LocalDateTime.now();
        List<ExamReminder> due = reminderRepository.findPendingRemindersToSend(now);

        if (due.isEmpty()) {
            return 0;
        }

        int sent = 0;

        for (ExamReminder reminder : due) {
            Invitation invitation = reminder.getInvitation();

            if (invitation == null || !isRemindable(invitation)) {
                reminder.setStatus(ReminderStatus.CANCELLED);
                reminder.setIsActive(false);
                reminder.setLastError("Invitation is no longer remindable");
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
                reminderRepository.save(reminder);
                sent++;
            } catch (Exception e) {
                reminder.setSendAttempts(reminder.getSendAttempts() + 1);
                reminder.setLastError(e.getMessage());
                reminder.setStatus(ReminderStatus.FAILED);
                reminder.setIsActive(false);
                reminderRepository.save(reminder);
                log.error("Failed to send reminder id={}: {}", reminder.getId(), e.getMessage());
            }
        }

        log.info("Sent {} out of {} due reminders", sent, due.size());
        return sent;
    }

    private LocalDateTime resolveScheduledAt(Exam exam, ReminderRequest request) {
        if (request.getReminderType() == ReminderType.CUSTOM) {
            if (request.getScheduledAt() == null) {
                throw new BadRequestException("scheduledAt is required for CUSTOM reminder");
            }
            return request.getScheduledAt();
        }

        if (exam.getStartTime() == null) {
            throw new BadRequestException("Exam has no start time, cannot auto-schedule reminder");
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

        return dto;
    }
}