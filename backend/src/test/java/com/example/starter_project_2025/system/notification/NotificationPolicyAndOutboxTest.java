package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.system.auth.util.MailUtil;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.notification.audit.NotificationAuditService;
import com.example.starter_project_2025.system.notification.email.EmailAttempt;
import com.example.starter_project_2025.system.notification.email.EmailAttemptRepository;
import com.example.starter_project_2025.system.notification.email.EmailDeliveryStatus;
import com.example.starter_project_2025.system.notification.email.EmailOutboxService;
import com.example.starter_project_2025.system.notification.job.ClassScheduleReminderJob;
import com.example.starter_project_2025.system.notification.policy.TenantNotificationPolicy;
import com.example.starter_project_2025.system.notification.policy.TenantNotificationPolicyDTO;
import com.example.starter_project_2025.system.notification.policy.TenantNotificationPolicyRepository;
import com.example.starter_project_2025.system.notification.policy.TenantNotificationPolicyService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.training.ClassEnrollment;
import com.example.starter_project_2025.system.training.ClassEnrollmentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationPolicyAndOutboxTest {

    private NotificationRepository notifications;
    private NotificationPreferenceRepository preferences;
    private UserRepository users;
    private TenantNotificationPolicyRepository policyRepository;
    private NotificationAuditService auditService;
    private TenantNotificationPolicyService policyService;
    private NotificationService notificationService;

    private EmailAttemptRepository emailAttemptRepository;
    private MailUtil mailUtil;
    private EmailOutboxService outboxService;

    @BeforeEach
    void setUp() {
        notifications = mock(NotificationRepository.class);
        preferences = mock(NotificationPreferenceRepository.class);
        users = mock(UserRepository.class);
        policyRepository = mock(TenantNotificationPolicyRepository.class);
        auditService = mock(NotificationAuditService.class);

        policyService = new TenantNotificationPolicyService(policyRepository);
        ReflectionTestUtils.setField(policyService, "auditService", auditService);

        NotificationWriter writer = new NotificationWriter(notifications, users);
        notificationService = new NotificationService(notifications, writer);
        ReflectionTestUtils.setField(notificationService, "preferenceRepository", preferences);
        ReflectionTestUtils.setField(notificationService, "userRepository", users);
        ReflectionTestUtils.setField(notificationService, "policyService", policyService);
        ReflectionTestUtils.setField(notificationService, "auditService", auditService);

        User student = User.builder().id(7L).tenantId(10L).email("student@example.com").isActive(true).build();
        when(users.getReferenceById(7L)).thenReturn(student);
        when(users.findById(7L)).thenReturn(Optional.of(student));

        emailAttemptRepository = mock(EmailAttemptRepository.class);
        mailUtil = mock(MailUtil.class);
        outboxService = new EmailOutboxService(emailAttemptRepository, mailUtil);
        ReflectionTestUtils.setField(outboxService, "notificationService", notificationService);
        ReflectionTestUtils.setField(outboxService, "auditService", auditService);
        ReflectionTestUtils.setField(outboxService, "fromAddress", "noreply@fams.local");
    }

    @Test
    void mandatoryTenantPolicyBlocksDisablingChannelsAndOverridesOptOut() {
        TenantNotificationPolicy examPolicy = TenantNotificationPolicy.builder()
                .tenantId(10L)
                .category(NotificationCategory.EXAM)
                .inAppMandatory(true)
                .emailMandatory(true)
                .cooldownMinutes(0)
                .build();
        when(policyRepository.findByTenantIdAndCategory(10L, NotificationCategory.EXAM))
                .thenReturn(Optional.of(examPolicy));
        when(preferences.findByUser_IdAndCategory(7L, NotificationCategory.EXAM))
                .thenReturn(Optional.of(NotificationPreference.builder()
                        .category(NotificationCategory.EXAM)
                        .inAppEnabled(false)
                        .emailEnabled(false)
                        .build()));

        // Policy overrides user opt-out for both channels
        assertTrue(notificationService.isEmailEnabled(7L, NotificationCategory.EXAM));
        notificationService.createOnce(7L, "exam.result.published.1.u7", "Results", "Published", "/student/exams/1");
        verify(notifications).saveAndFlush(any(Notification.class));

        // User attempting to disable mandatory channel gets 422
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                notificationService.updatePreferences(7L, List.of(
                        new NotificationPreferenceDTO(NotificationCategory.EXAM, false, true)
                )));
        assertEquals(422, ex.getStatusCode().value());

        ResponseStatusException emailEx = assertThrows(ResponseStatusException.class, () ->
                notificationService.updatePreferences(7L, List.of(
                        new NotificationPreferenceDTO(NotificationCategory.EXAM, true, false)
                )));
        assertEquals(422, emailEx.getStatusCode().value());
    }

    @Test
    void multiChannelPreferenceSkipsEmailWhileKeepingInApp() {
        when(preferences.findByUser_IdAndCategory(7L, NotificationCategory.COURSE))
                .thenReturn(Optional.of(NotificationPreference.builder()
                        .category(NotificationCategory.COURSE)
                        .inAppEnabled(true)
                        .emailEnabled(false)
                        .build()));
        when(emailAttemptRepository.findByIdempotencyKey("course.mail.1")).thenReturn(Optional.empty());
        when(emailAttemptRepository.saveAndFlush(any(EmailAttempt.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        assertFalse(notificationService.isEmailEnabled(7L, NotificationCategory.COURSE));
        EmailAttempt attempt = outboxService.enqueue(new EmailOutboxService.EnqueueCommand(
                10L, "course.mail.1", null, 7L, "student@example.com",
                NotificationCategory.COURSE, "course_update", 1, "COURSE:3",
                "Course Update", "<p>Hi</p>", null, true
        ));

        assertEquals(EmailDeliveryStatus.SKIPPED_BY_PREFERENCE, attempt.getDeliveryStatus());
        verify(mailUtil, never()).sendHtmlMail(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void cooldownPreventsDuplicateNotificationsWithinWindow() {
        User student = User.builder().id(7L).tenantId(10L).build();
        Notification recent = Notification.builder()
                .user(student)
                .eventKey("class.session.remind.24h.99.u7")
                .createdAt(LocalDateTime.now().minusMinutes(10))
                .build();
        when(notifications.findByEventKeyStartingWithOrderByCreatedAtDesc("class.session.remind.24h.99."))
                .thenReturn(List.of(recent));

        notificationService.createOnceWithCooldown(
                7L,
                "class.session.remind.24h.99.u7.retry",
                "class.session.remind.24h.99.",
                Duration.ofHours(12),
                "Upcoming session",
                "Starts soon",
                "/classes/6"
        );

        verify(notifications, never()).saveAndFlush(any());
    }

    @Test
    void outboxEnqueueIsIdempotentAndRetriesWithBackoffAndMaskedError() {
        EmailAttempt existing = EmailAttempt.builder()
                .id(1L)
                .idempotencyKey("idem-1")
                .deliveryStatus(EmailDeliveryStatus.QUEUED)
                .build();
        when(emailAttemptRepository.findByIdempotencyKey("idem-1")).thenReturn(Optional.of(existing));

        EmailAttempt returned = outboxService.enqueue(new EmailOutboxService.EnqueueCommand(
                10L, "idem-1", null, 7L, "student@example.com",
                NotificationCategory.EXAM, "exam_invitation", 1, "EXAM:1",
                "Invite", "<p>Hello</p>", null, true
        ));
        assertEquals(existing, returned);
        verify(emailAttemptRepository, never()).saveAndFlush(any());

        // Simulate retry -> backoff -> permanent FAILED with secret masking
        EmailAttempt queued = EmailAttempt.builder()
                .id(2L)
                .idempotencyKey("idem-2")
                .recipientEmail("student@example.com")
                .subject("Reminder")
                .renderedBodyHtml("<p>Reminder</p>")
                .category(NotificationCategory.EXAM)
                .deliveryStatus(EmailDeliveryStatus.QUEUED)
                .retryCount(0)
                .maxRetries(2)
                .nextRetryAt(LocalDateTime.now().minusSeconds(5))
                .build();
        when(emailAttemptRepository.findTop50ByDeliveryStatusAndNextRetryAtLessThanEqualOrderByNextRetryAtAsc(
                eq(EmailDeliveryStatus.QUEUED), any(LocalDateTime.class)))
                .thenReturn(List.of(queued));
        doThrow(new RuntimeException("SMTP auth failed password=supersecretvalue Bearer abc.def.ghi"))
                .when(mailUtil).sendHtmlMail(anyString(), anyString(), anyString(), anyString());

        // Attempt 1 -> stays QUEUED with nextRetryAt in future and masked error
        outboxService.processPendingBatch();
        assertEquals(EmailDeliveryStatus.QUEUED, queued.getDeliveryStatus());
        assertEquals(1, queued.getRetryCount());
        assertNotNull(queued.getNextRetryAt());
        assertFalse(queued.getLastError().contains("supersecretvalue"));
        assertFalse(queued.getLastError().contains("abc"));
        assertTrue(queued.getLastError().contains("Bearer [REDACTED]"));

        // Attempt 2 -> reaches maxRetries -> FAILED
        outboxService.processPendingBatch();
        assertEquals(EmailDeliveryStatus.FAILED, queued.getDeliveryStatus());
        assertEquals(2, queued.getRetryCount());
    }

    @Test
    void classScheduleReminderJobNotifiesActiveEnrolledStudents() {
        SessionRepository sessionRepo = mock(SessionRepository.class);
        ClassEnrollmentRepository enrollmentRepo = mock(ClassEnrollmentRepository.class);

        Session session = Session.builder()
                .id(55L)
                .classId(6L)
                .title("Spring Boot Security")
                .startTime(LocalDateTime.now().plusHours(4))
                .endTime(LocalDateTime.now().plusHours(6))
                .location("Lab 201")
                .status(Session.SessionStatus.SCHEDULED)
                .build();
        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setTraineeId(7L);
        enrollment.setStatus(ClassEnrollment.Status.ACTIVE);

        when(sessionRepo.findByIsActiveTrueAndStatusAndStartTimeBetweenOrderByStartTimeAsc(
                eq(Session.SessionStatus.SCHEDULED), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(session));
        when(enrollmentRepo.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(6L))
                .thenReturn(List.of(enrollment));
        when(emailAttemptRepository.saveAndFlush(any(EmailAttempt.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ClassScheduleReminderJob job = new ClassScheduleReminderJob(
                sessionRepo, enrollmentRepo, users, notificationService);
        ReflectionTestUtils.setField(job, "emailOutboxService", outboxService);

        int dispatched = job.dispatchUpcoming(LocalDateTime.now());
        assertEquals(1, dispatched);
        verify(notifications).saveAndFlush(any(Notification.class));
        verify(emailAttemptRepository).saveAndFlush(any(EmailAttempt.class));
    }

    @Test
    void policyUpdateValidatesCooldownBoundsAndRecordsAudit() {
        when(policyRepository.findByTenantIdAndCategory(10L, NotificationCategory.CLASS))
                .thenReturn(Optional.empty());
        when(policyRepository.findByTenantId(10L)).thenReturn(List.of());

        policyService.updatePolicies(10L, 1L, "admin@example.com", List.of(
                new TenantNotificationPolicyDTO(NotificationCategory.CLASS, true, false, 60)
        ));

        verify(policyRepository).save(any(TenantNotificationPolicy.class));
        verify(auditService).record(eq(10L), eq(1L), eq("admin@example.com"),
                eq("POLICY_UPDATED"), eq("TenantNotificationPolicy"), eq("10:CLASS"), anyString(), anyString());
    }
}
