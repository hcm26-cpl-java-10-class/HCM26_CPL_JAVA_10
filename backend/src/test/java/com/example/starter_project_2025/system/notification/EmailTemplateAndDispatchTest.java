package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.auth.util.MailUtil;
import com.example.starter_project_2025.system.notification.audit.NotificationAuditService;
import com.example.starter_project_2025.system.notification.email.EmailAttempt;
import com.example.starter_project_2025.system.notification.email.EmailAttemptRepository;
import com.example.starter_project_2025.system.notification.email.EmailDeliveryStatus;
import com.example.starter_project_2025.system.notification.email.EmailDispatchService;
import com.example.starter_project_2025.system.notification.email.EmailOutboxService;
import com.example.starter_project_2025.system.notification.email.EmailSendRequest;
import com.example.starter_project_2025.system.notification.template.EmailHtmlSanitizer;
import com.example.starter_project_2025.system.notification.template.EmailTemplate;
import com.example.starter_project_2025.system.notification.template.EmailTemplateDTO;
import com.example.starter_project_2025.system.notification.template.EmailTemplateRepository;
import com.example.starter_project_2025.system.notification.template.EmailTemplateService;
import com.example.starter_project_2025.system.notification.template.EmailTemplateUpsertRequest;
import com.example.starter_project_2025.system.notification.template.EmailTemplateVersion;
import com.example.starter_project_2025.system.notification.template.EmailTemplateVersionRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.training.ClassEnrollment;
import com.example.starter_project_2025.system.training.ClassEnrollmentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailTemplateAndDispatchTest {

    private EmailTemplateRepository templateRepository;
    private EmailTemplateVersionRepository versionRepository;
    private EmailTemplateService templateService;
    private EmailAttemptRepository attemptRepository;
    private NotificationService notificationService;
    private EmailOutboxService outboxService;
    private UserRepository userRepository;
    private ClassEnrollmentRepository enrollmentRepository;
    private EmailDispatchService dispatchService;

    @BeforeEach
    void setUp() {
        templateRepository = mock(EmailTemplateRepository.class);
        versionRepository = mock(EmailTemplateVersionRepository.class);
        NotificationAuditService auditService = mock(NotificationAuditService.class);

        templateService = new EmailTemplateService(templateRepository, versionRepository);
        ReflectionTestUtils.setField(templateService, "auditService", auditService);

        attemptRepository = mock(EmailAttemptRepository.class);
        MailUtil mailUtil = mock(MailUtil.class);
        notificationService = mock(NotificationService.class);
        outboxService = new EmailOutboxService(attemptRepository, mailUtil);
        ReflectionTestUtils.setField(outboxService, "notificationService", notificationService);
        ReflectionTestUtils.setField(outboxService, "auditService", auditService);

        userRepository = mock(UserRepository.class);
        enrollmentRepository = mock(ClassEnrollmentRepository.class);
        dispatchService = new EmailDispatchService(
                attemptRepository, outboxService, templateService, userRepository, enrollmentRepository
        );
        ReflectionTestUtils.setField(dispatchService, "auditService", auditService);
    }

    @Test
    void htmlSanitizerStripsScriptsEventHandlersDangerousUrisAndEscapesVariables() {
        String raw = "<p>Hello {{studentName}}</p>"
                + "<script>alert('xss')</script>"
                + "<iframe src=\"https://evil.test\"></iframe>"
                + "<a href=\"javascript:alert(1)\" onclick=\"steal()\">Click</a>";

        String result = EmailHtmlSanitizer.interpolateAndSanitizeHtml(
                raw,
                Map.of("studentName", "<img src=x onerror=alert(2)>Alice")
        );

        assertFalse(result.toLowerCase().contains("<script"));
        assertFalse(result.toLowerCase().contains("<iframe"));
        assertFalse(result.toLowerCase().contains("onclick"));
        assertFalse(result.toLowerCase().contains("javascript:"));
        assertTrue(result.contains("&lt;img src=x onerror=alert(2)&gt;Alice"));
        assertTrue(result.contains("href=\"#\""));
    }

    @Test
    void templateUpdateIncrementsVersionAndPersistsImmutableSnapshot() {
        EmailTemplate existing = EmailTemplate.builder()
                .id(10L)
                .tenantId(0L)
                .code("CLASS_WELCOME")
                .name("Welcome v1")
                .category(NotificationCategory.CLASS)
                .active(true)
                .currentVersion(1)
                .subjectTemplate("Old subject")
                .bodyHtml("<p>Old body</p>")
                .build();
        when(templateRepository.findById(10L)).thenReturn(Optional.of(existing));
        when(templateRepository.save(any(EmailTemplate.class))).thenAnswer(inv -> inv.getArgument(0));
        when(versionRepository.save(any(EmailTemplateVersion.class))).thenAnswer(inv -> inv.getArgument(0));

        EmailTemplateDTO updated = templateService.update(
                0L, 1L, "admin@example.com", 10L,
                new EmailTemplateUpsertRequest(
                        "CLASS_WELCOME", "Welcome v2", NotificationCategory.CLASS, "desc",
                        "New subject {{studentName}}", "<p>New body</p><script>bad()</script>", "{}", "Updated copy"
                )
        );

        assertEquals(2, updated.currentVersion());
        assertFalse(updated.bodyHtml().contains("<script"));
        ArgumentCaptor<EmailTemplateVersion> versionCaptor = ArgumentCaptor.forClass(EmailTemplateVersion.class);
        verify(versionRepository).save(versionCaptor.capture());
        assertEquals(2, versionCaptor.getValue().getVersion());
        assertEquals("Updated copy", versionCaptor.getValue().getChangeNote());
    }

    @Test
    void bulkSendReturnsPartialResultsAndProtectsAgainstDoubleSubmit() {
        User optedOutUser = User.builder().id(8L).tenantId(1L).email("optout@example.com").firstName("Bob").build();
        User activeUser = User.builder().id(9L).tenantId(1L).email("valid@example.com").firstName("Alice").build();
        when(userRepository.findByEmail("optout@example.com")).thenReturn(Optional.of(optedOutUser));
        when(userRepository.findByEmail("valid@example.com")).thenReturn(Optional.of(activeUser));
        when(userRepository.findByEmail("not-an-email")).thenReturn(Optional.empty());
        when(notificationService.isEmailEnabled(8L, NotificationCategory.CLASS)).thenReturn(false);
        when(notificationService.isEmailEnabled(9L, NotificationCategory.CLASS)).thenReturn(true);
        when(attemptRepository.findByBatchIdOrderByIdAsc("batch-key-1")).thenReturn(List.of());
        when(attemptRepository.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(attemptRepository.saveAndFlush(any(EmailAttempt.class))).thenAnswer(inv -> {
            EmailAttempt a = inv.getArgument(0);
            a.setId(100L);
            return a;
        });

        EmailSendRequest request = new EmailSendRequest(
                null,
                "Hello {{studentName}}",
                "<p>Welcome {{studentName}}</p>",
                NotificationCategory.CLASS,
                "CLASS:6",
                null,
                null,
                List.of("valid@example.com", "optout@example.com", "not-an-email"),
                Map.of(),
                null,
                true
        );

        EmailSendRequest.BatchResult first = dispatchService.send(1L, 1L, "admin@example.com", "batch-key-1", request);
        assertFalse(first.duplicateRequest());
        assertEquals(3, first.total());
        assertEquals(1, first.queuedCount());
        assertEquals(1, first.skippedCount());
        assertEquals(1, first.failedCount());

        // Double-submit replay with same Idempotency-Key returns existing batch without re-enqueuing
        EmailAttempt existingAttempt = EmailAttempt.builder()
                .id(100L)
                .batchId("batch-key-1")
                .recipientEmail("valid@example.com")
                .deliveryStatus(EmailDeliveryStatus.QUEUED)
                .build();
        when(attemptRepository.findByBatchIdOrderByIdAsc("batch-key-1")).thenReturn(List.of(existingAttempt));

        EmailSendRequest.BatchResult replay = dispatchService.send(1L, 1L, "admin@example.com", "batch-key-1", request);
        assertTrue(replay.duplicateRequest());
        assertEquals(1, replay.queuedCount());
        verify(attemptRepository, times(2)).saveAndFlush(any(EmailAttempt.class)); // only from first call
    }

    @Test
    void inactiveTemplateIsRejectedAndClassRecipientsAreResolved() {
        EmailTemplate inactive = EmailTemplate.builder()
                .id(20L).tenantId(0L).code("OLD_TPL").active(false)
                .category(NotificationCategory.SYSTEM).subjectTemplate("S").bodyHtml("<p>B</p>").build();
        when(templateRepository.findById(20L)).thenReturn(Optional.of(inactive));

        assertThrows(BadRequestException.class, () -> dispatchService.send(
                0L, 1L, "admin@example.com", "key-inactive",
                new EmailSendRequest(20L, null, null, null, null, null, null, List.of("a@b.com"), null, null, true)
        ));

        ClassEnrollment active = new ClassEnrollment();
        active.setTraineeId(9L);
        active.setStatus(ClassEnrollment.Status.ACTIVE);
        User trainee = User.builder().id(9L).tenantId(0L).email("trainee@example.com").firstName("An").build();
        when(enrollmentRepository.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(6L)).thenReturn(List.of(active));
        when(userRepository.findById(9L)).thenReturn(Optional.of(trainee));
        when(notificationService.isEmailEnabled(9L, NotificationCategory.CLASS)).thenReturn(true);
        when(attemptRepository.findByBatchIdOrderByIdAsc("key-class")).thenReturn(List.of());
        when(attemptRepository.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(attemptRepository.saveAndFlush(any(EmailAttempt.class))).thenAnswer(inv -> inv.getArgument(0));

        EmailSendRequest.BatchResult res = dispatchService.send(
                0L, 1L, "admin@example.com", "key-class",
                new EmailSendRequest(null, "Class Notice", "<p>Hi {{studentName}}</p>",
                        NotificationCategory.CLASS, null, 6L, null, null, null, null, true)
        );
        assertEquals(1, res.queuedCount());
        assertEquals("trainee@example.com", res.items().getFirst().recipientEmail());
    }
}
