package com.example.starter_project_2025.system.notification.email;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.notification.NotificationCategory;
import com.example.starter_project_2025.system.notification.audit.NotificationAuditService;
import com.example.starter_project_2025.system.notification.template.EmailHtmlSanitizer;
import com.example.starter_project_2025.system.notification.template.EmailTemplate;
import com.example.starter_project_2025.system.notification.template.EmailTemplateService;
import com.example.starter_project_2025.system.notification.template.EmailTemplateUpsertRequest;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.training.ClassEnrollment;
import com.example.starter_project_2025.system.training.ClassEnrollmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class EmailDispatchService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final EmailAttemptRepository attemptRepository;
    private final EmailOutboxService outboxService;
    private final EmailTemplateService templateService;
    private final UserRepository userRepository;
    private final ClassEnrollmentRepository classEnrollmentRepository;

    @Autowired(required = false)
    private NotificationAuditService auditService;

    private record ResolvedRecipient(String email, Long userId, String displayName, Long tenantId) {
    }

    @Transactional(readOnly = true)
    public Page<EmailAttemptDTO> searchHistory(
            Long tenantId,
            Long actorId,
            boolean isAdmin,
            String contextRef,
            String recipient,
            EmailDeliveryStatus status,
            NotificationCategory category,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            int page,
            int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0),
                safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"))
        );

        Long restrictActorId = (!isAdmin && actorId != null) ? actorId : null;
        String cleanContext = (contextRef == null || contextRef.isBlank()) ? null : contextRef.trim();
        String cleanRecipient = (recipient == null || recipient.isBlank()) ? null : recipient.trim();

        return attemptRepository.searchHistory(
                tenantId,
                restrictActorId,
                cleanContext,
                cleanRecipient,
                status,
                category,
                fromDate,
                toDate,
                pageable
        ).map(a -> EmailAttemptDTO.from(a, false));
    }

    @Transactional(readOnly = true)
    public EmailAttemptDTO getHistoryDetail(Long tenantId, Long actorId, boolean isAdmin, Long id) {
        EmailAttempt attempt = attemptRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Email attempt not found"));
        if (tenantId != null && attempt.getTenantId() != null && !tenantId.equals(attempt.getTenantId())) {
            throw new ResourceNotFoundException("Email attempt not found");
        }
        if (!isAdmin && attempt.getCreatedByUserId() != null && !attempt.getCreatedByUserId().equals(actorId)) {
            throw new ResourceNotFoundException("Email attempt not found");
        }
        return EmailAttemptDTO.from(attempt, true);
    }

    @Transactional
    public EmailAttemptDTO retryHistory(Long tenantId, Long actorId, String actorEmail, boolean isAdmin, Long id) {
        getHistoryDetail(tenantId, actorId, isAdmin, id);
        EmailAttempt updated = outboxService.retryFailed(id, actorId, actorEmail);
        return EmailAttemptDTO.from(updated, true);
    }

    @Transactional(readOnly = true)
    public EmailTemplateUpsertRequest.PreviewResponse previewCompose(Long tenantId, EmailSendRequest request) {
        if (request == null) {
            throw new BadRequestException("Compose request is required");
        }
        String subjectTemplate = request.subject();
        String bodyTemplate = request.bodyHtml();
        if (request.templateId() != null) {
            EmailTemplate template = templateService.getVisibleEntity(tenantId, request.templateId());
            if (subjectTemplate == null || subjectTemplate.isBlank()) {
                subjectTemplate = template.getSubjectTemplate();
            }
            if (bodyTemplate == null || bodyTemplate.isBlank()) {
                bodyTemplate = template.getBodyHtml();
            }
        }
        Map<String, Object> vars = new HashMap<>();
        if (request.variables() != null) {
            vars.putAll(request.variables());
        }
        vars.putIfAbsent("studentName", "Sample Student");
        vars.putIfAbsent("recipientEmail", "student@example.com");
        return new EmailTemplateUpsertRequest.PreviewResponse(
                EmailHtmlSanitizer.interpolatePlain(subjectTemplate, vars),
                EmailHtmlSanitizer.interpolateAndSanitizeHtml(bodyTemplate, vars)
        );
    }

    @Transactional
    public EmailSendRequest.BatchResult send(
            Long tenantId,
            Long actorId,
            String actorEmail,
            String headerIdempotencyKey,
            EmailSendRequest request
    ) {
        if (request == null) {
            throw new BadRequestException("Send request is required");
        }

        String templateCode = "CUSTOM";
        Integer templateVersion = null;
        String subjectTemplate = request.subject();
        String bodyTemplate = request.bodyHtml();
        NotificationCategory category = request.category() != null ? request.category() : NotificationCategory.SYSTEM;

        if (request.templateId() != null) {
            EmailTemplate template = templateService.getVisibleEntity(tenantId, request.templateId());
            if (!template.isActive()) {
                throw new BadRequestException("Selected email template is inactive: " + template.getCode());
            }
            templateCode = template.getCode();
            templateVersion = template.getCurrentVersion();
            if (subjectTemplate == null || subjectTemplate.isBlank()) {
                subjectTemplate = template.getSubjectTemplate();
            }
            if (bodyTemplate == null || bodyTemplate.isBlank()) {
                bodyTemplate = template.getBodyHtml();
            }
            if (request.category() == null) {
                category = template.getCategory();
            }
        }

        if (subjectTemplate == null || subjectTemplate.isBlank()) {
            throw new BadRequestException("Email subject is required");
        }
        if (bodyTemplate == null || bodyTemplate.isBlank()) {
            throw new BadRequestException("Email body is required");
        }

        String rawKey = (headerIdempotencyKey != null && !headerIdempotencyKey.isBlank())
                ? headerIdempotencyKey.trim()
                : (request.idempotencyKey() != null && !request.idempotencyKey().isBlank()
                        ? request.idempotencyKey().trim()
                        : "manual-" + UUID.randomUUID());

        // Check if this exact batch idempotency key was already submitted (double-submit protection)
        List<EmailAttempt> existingBatch = attemptRepository.findByBatchIdOrderByIdAsc(rawKey);
        if (!existingBatch.isEmpty()) {
            return buildDuplicateBatchResult(rawKey, existingBatch);
        }

        List<ResolvedRecipient> recipients = collectRecipients(request, tenantId);
        if (recipients.isEmpty()) {
            throw new BadRequestException("At least one recipient (email, user ID, or class) is required");
        }

        String contextRef = (request.contextRef() != null && !request.contextRef().isBlank())
                ? request.contextRef().trim()
                : (request.classId() != null ? "CLASS:" + request.classId() : "MANUAL");
        boolean respectPref = request.respectPreference() == null || request.respectPreference();

        List<EmailSendRequest.BatchItemResult> results = new ArrayList<>();
        int queued = 0;
        int skipped = 0;
        int failed = 0;

        for (ResolvedRecipient recipient : recipients) {
            String email = recipient.email() == null ? "" : recipient.email().trim();
            if (email.isBlank() || !EMAIL_PATTERN.matcher(email).matches()) {
                failed++;
                results.add(new EmailSendRequest.BatchItemResult(
                        email, recipient.userId(), null, "FAILED", "Invalid or missing email address"
                ));
                continue;
            }

            Map<String, Object> vars = new HashMap<>();
            if (request.variables() != null) {
                vars.putAll(request.variables());
            }
            vars.putIfAbsent("studentName", recipient.displayName() != null ? recipient.displayName() : email);
            vars.putIfAbsent("recipientEmail", email);

            String renderedSubject = EmailHtmlSanitizer.interpolatePlain(subjectTemplate, vars);
            String renderedBody = EmailHtmlSanitizer.interpolateAndSanitizeHtml(bodyTemplate, vars);
            String itemIdempotencyKey = rawKey + ":" + email.toLowerCase(Locale.ROOT);

            try {
                EmailAttempt attempt = outboxService.enqueue(new EmailOutboxService.EnqueueCommand(
                        recipient.tenantId() != null ? recipient.tenantId() : tenantId,
                        itemIdempotencyKey,
                        rawKey,
                        recipient.userId(),
                        email,
                        category,
                        templateCode,
                        templateVersion,
                        contextRef,
                        renderedSubject,
                        renderedBody,
                        actorId,
                        respectPref
                ));
                if (attempt.getDeliveryStatus() == EmailDeliveryStatus.SKIPPED_BY_PREFERENCE) {
                    skipped++;
                    results.add(new EmailSendRequest.BatchItemResult(
                            email, recipient.userId(), attempt.getId(), "SKIPPED_BY_PREFERENCE", attempt.getLastError()
                    ));
                } else {
                    queued++;
                    results.add(new EmailSendRequest.BatchItemResult(
                            email, recipient.userId(), attempt.getId(), attempt.getDeliveryStatus().name(), null
                    ));
                }
            } catch (Exception ex) {
                failed++;
                results.add(new EmailSendRequest.BatchItemResult(
                        email, recipient.userId(), null, "FAILED", EmailOutboxService.maskSensitiveError(ex.getMessage())
                ));
            }
        }

        if (auditService != null) {
            auditService.record(tenantId, actorId, actorEmail, "EMAIL_BATCH_DISPATCHED",
                    "EmailBatch", rawKey, null,
                    "total=" + recipients.size() + ",queued=" + queued + ",skipped=" + skipped + ",failed=" + failed);
        }

        return new EmailSendRequest.BatchResult(
                rawKey, rawKey, false, recipients.size(), queued, skipped, failed, results
        );
    }

    private EmailSendRequest.BatchResult buildDuplicateBatchResult(String batchId, List<EmailAttempt> existing) {
        List<EmailSendRequest.BatchItemResult> items = new ArrayList<>();
        int queued = 0;
        int skipped = 0;
        int failed = 0;
        for (EmailAttempt a : existing) {
            if (a.getDeliveryStatus() == EmailDeliveryStatus.SKIPPED_BY_PREFERENCE) {
                skipped++;
            } else if (a.getDeliveryStatus() == EmailDeliveryStatus.FAILED) {
                failed++;
            } else {
                queued++;
            }
            items.add(new EmailSendRequest.BatchItemResult(
                    a.getRecipientEmail(), a.getRecipientUserId(), a.getId(), a.getDeliveryStatus().name(), a.getLastError()
            ));
        }
        return new EmailSendRequest.BatchResult(
                batchId, batchId, true, existing.size(), queued, skipped, failed, items
        );
    }

    private List<ResolvedRecipient> collectRecipients(EmailSendRequest request, Long fallbackTenantId) {
        Map<String, ResolvedRecipient> deduped = new LinkedHashMap<>();
        int invalidCounter = 0;

        if (request.classId() != null) {
            List<ClassEnrollment> enrollments = classEnrollmentRepository
                    .findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(request.classId());
            for (ClassEnrollment e : enrollments) {
                if (e.getStatus() != ClassEnrollment.Status.ACTIVE) {
                    continue;
                }
                User user = e.getTraineeId() != null ? userRepository.findById(e.getTraineeId()).orElse(null) : null;
                String email = (user != null && user.getEmail() != null && !user.getEmail().isBlank())
                        ? user.getEmail().trim()
                        : (e.getPersonalEmail() != null ? e.getPersonalEmail().trim() : "");
                String name = user != null ? user.getFullName() : e.getFullName();
                Long userId = user != null ? user.getId() : e.getTraineeId();
                Long tenantId = user != null ? user.getTenantId() : fallbackTenantId;
                String mapKey = email.isBlank() ? "invalid-" + (++invalidCounter) : email.toLowerCase(Locale.ROOT);
                deduped.putIfAbsent(mapKey, new ResolvedRecipient(email, userId, name, tenantId));
            }
        }

        if (request.recipientUserIds() != null) {
            for (Long uid : request.recipientUserIds()) {
                if (uid == null) continue;
                userRepository.findById(uid).ifPresent(user -> {
                    String email = user.getEmail() == null ? "" : user.getEmail().trim();
                    String mapKey = email.isBlank() ? "user-" + uid : email.toLowerCase(Locale.ROOT);
                    deduped.putIfAbsent(mapKey, new ResolvedRecipient(email, user.getId(), user.getFullName(), user.getTenantId()));
                });
            }
        }

        if (request.recipientEmails() != null) {
            for (String rawEmail : request.recipientEmails()) {
                if (rawEmail == null) continue;
                String email = rawEmail.trim();
                if (email.isEmpty()) continue;
                String mapKey = email.toLowerCase(Locale.ROOT);
                if (!deduped.containsKey(mapKey)) {
                    User matched = userRepository.findByEmail(email).orElse(null);
                    deduped.put(mapKey, new ResolvedRecipient(
                            email,
                            matched != null ? matched.getId() : null,
                            matched != null ? matched.getFullName() : email,
                            matched != null ? matched.getTenantId() : fallbackTenantId
                    ));
                }
            }
        }

        return new ArrayList<>(deduped.values());
    }
}
