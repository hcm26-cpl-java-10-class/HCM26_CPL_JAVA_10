package com.example.starter_project_2025.system.notification.job;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.notification.NotificationCategory;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.notification.email.EmailOutboxService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.training.ClassEnrollment;
import com.example.starter_project_2025.system.training.ClassEnrollmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * UFR-COM-007: Automated reminder for upcoming class sessions within the next 24 hours.
 * Deduplicates per session and user via eventKey + cooldown and queues reminder emails through the outbox.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ClassScheduleReminderJob {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final SessionRepository sessionRepository;
    private final ClassEnrollmentRepository enrollmentRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Autowired(required = false)
    private EmailOutboxService emailOutboxService;

    @Value("${app.notification.class-reminder-enabled:true}")
    private boolean enabled;

    @Scheduled(fixedDelayString = "${app.notification.class-reminder-poll-ms:300000}")
    public void sendUpcomingSessionReminders() {
        if (!enabled) {
            return;
        }
        try {
            int dispatched = dispatchUpcoming(LocalDateTime.now());
            if (dispatched > 0) {
                log.debug("ClassScheduleReminderJob dispatched {} class session reminder(s)", dispatched);
            }
        } catch (Exception ex) {
            log.error("ClassScheduleReminderJob failed: {}", ex.getMessage());
        }
    }

    public int dispatchUpcoming(LocalDateTime now) {
        LocalDateTime horizon = now.plusHours(24);
        List<Session> upcoming = sessionRepository
                .findByIsActiveTrueAndStatusAndStartTimeBetweenOrderByStartTimeAsc(
                        Session.SessionStatus.SCHEDULED,
                        now,
                        horizon
                );
        int count = 0;
        for (Session session : upcoming) {
            if (session.getClassId() == null || session.getId() == null) {
                continue;
            }
            List<ClassEnrollment> enrollments = enrollmentRepository
                    .findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(session.getClassId());
            for (ClassEnrollment enrollment : enrollments) {
                if (enrollment.getStatus() != ClassEnrollment.Status.ACTIVE) {
                    continue;
                }
                Optional<User> recipientOpt = resolveRecipient(enrollment);
                if (recipientOpt.isEmpty()) {
                    continue;
                }
                User recipient = recipientOpt.get();
                if (!Boolean.TRUE.equals(recipient.getIsActive())) {
                    continue;
                }
                String formattedStart = session.getStartTime() != null ? session.getStartTime().format(TIME_FMT) : "";
                String locationSuffix = (session.getLocation() != null && !session.getLocation().isBlank())
                        ? " at " + session.getLocation()
                        : "";
                String title = "Upcoming class session";
                String message = "Session \"" + session.getTitle() + "\" starts at " + formattedStart + locationSuffix + ".";
                String targetUrl = "/classes/" + session.getClassId();
                String eventKey = "class.session.remind.24h." + session.getId() + ".u" + recipient.getId();
                String cooldownPrefix = "class.session.remind.24h." + session.getId() + ".";

                notificationService.createOnceWithCooldown(
                        recipient.getId(),
                        eventKey,
                        cooldownPrefix,
                        Duration.ofHours(12),
                        title,
                        message,
                        targetUrl
                );

                if (emailOutboxService != null && recipient.getEmail() != null && !recipient.getEmail().isBlank()) {
                    String safeTitle = HtmlUtils.htmlEscape(session.getTitle() == null ? "" : session.getTitle());
                    String safeLoc = HtmlUtils.htmlEscape(locationSuffix);
                    String body = "<p>Hello " + HtmlUtils.htmlEscape(recipient.getFullName()) + ",</p>"
                            + "<p>This is a reminder that your class session <strong>" + safeTitle + "</strong> starts at "
                            + HtmlUtils.htmlEscape(formattedStart) + safeLoc + ".</p>";
                    emailOutboxService.enqueue(new EmailOutboxService.EnqueueCommand(
                            recipient.getTenantId(),
                            "email:" + eventKey,
                            null,
                            recipient.getId(),
                            recipient.getEmail(),
                            NotificationCategory.CLASS,
                            "class_session_reminder",
                            1,
                            "CLASS:" + session.getClassId(),
                            "[Reminder] " + session.getTitle(),
                            body,
                            null,
                            true
                    ));
                }
                count++;
            }
        }
        return count;
    }

    private Optional<User> resolveRecipient(ClassEnrollment enrollment) {
        if (enrollment.getTraineeId() != null) {
            Optional<User> byId = userRepository.findById(enrollment.getTraineeId());
            if (byId.isPresent()) {
                return byId;
            }
        }
        if (enrollment.getPersonalEmail() != null && !enrollment.getPersonalEmail().isBlank()) {
            return userRepository.findByEmail(enrollment.getPersonalEmail().trim());
        }
        return Optional.empty();
    }
}
