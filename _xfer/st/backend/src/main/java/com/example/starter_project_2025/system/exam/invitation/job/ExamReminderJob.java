package com.example.starter_project_2025.system.exam.invitation.job;

import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.invitation.domain.Invitation;
import com.example.starter_project_2025.system.exam.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.exam.invitation.domain.InvitationStatus;
import com.example.starter_project_2025.system.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.time.ZoneId;

/**
 * Reminds invited students before their exam window opens (24 hours and 1 hour ahead).
 * Each reminder is created once per invitation and opening time (see the event key), so the job can run often
 * and re-sending after a reschedule happens naturally because the opening time is part of the key.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExamReminderJob {

    /** Reminder windows, nearest first. */
    public enum Window {
        ONE_HOUR("1h", Duration.ofHours(1)),
        ONE_DAY("24h", Duration.ofHours(24));

        final String code;
        final Duration lead;

        Window(String code, Duration lead) {
            this.code = code;
            this.lead = lead;
        }

        public String code() {
            return code;
        }
    }

    private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final InvitationRepository invitationRepository;
    private final NotificationService notificationService;

    /**
     * Which reminder is due for an exam that opens at {@code opensAt}, seen from {@code now}.
     * The 24h reminder is skipped once less than an hour remains (the 1h one covers it).
     */
    public static Optional<Window> dueWindow(LocalDateTime now, LocalDateTime opensAt) {
        if (opensAt == null || !opensAt.isAfter(now)) {
            return Optional.empty();
        }
        Duration remaining = Duration.between(now, opensAt);
        if (remaining.compareTo(Window.ONE_HOUR.lead) <= 0) {
            return Optional.of(Window.ONE_HOUR);
        }
        if (remaining.compareTo(Window.ONE_DAY.lead) <= 0) {
            return Optional.of(Window.ONE_DAY);
        }
        return Optional.empty();
    }

    @Scheduled(fixedDelayString = "${app.exam.reminder-check-ms:300000}")
    @Transactional
    public void sendReminders() {
        try {
            int sent = sendReminders(LocalDateTime.now());
            if (sent > 0) {
                log.info("ExamReminderJob handled {} reminder(s)", sent);
            }
        } catch (RuntimeException ex) {
            log.warn("ExamReminderJob failed: {}", ex.getMessage());
        }
    }

    /** Returns how many invitations were due (not how many were new, because creation is idempotent). */
    public int sendReminders(LocalDateTime now) {
        List<Invitation> upcoming = invitationRepository.findUpcomingForReminders(
                EnumSet.of(InvitationStatus.SENT, InvitationStatus.ACCEPTED),
                now, now.plus(Window.ONE_DAY.lead));
        int due = 0;
        for (Invitation invitation : upcoming) {
            if (invitation.getUser() == null || invitation.getExam() == null) {
                continue;
            }
            Optional<Window> window = dueWindow(now, invitation.getAvailableFrom());
            if (window.isEmpty()) {
                continue;
            }
            due++;
            Exam exam = invitation.getExam();
            String opens = invitation.getAvailableFrom().format(WHEN);
            notificationService.createOnce(
                    invitation.getUser().getId(),
                    "exam.reminder." + window.get().code() + "." + invitation.getId() + "."
                            + invitation.getAvailableFrom().atZone(ZoneId.systemDefault()).toEpochSecond(),
                    window.get() == Window.ONE_HOUR ? "Exam starts within 1 hour" : "Exam starts within 24 hours",
                    "\"" + exam.getTitle() + "\" opens at " + opens + ".",
                    "/student/exams/" + exam.getId() + "/prepare");
        }
        return due;
    }
}
