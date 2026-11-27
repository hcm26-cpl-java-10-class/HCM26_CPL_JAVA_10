package com.example.starter_project_2025.system.notification.email;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.auth.util.MailUtil;
import com.example.starter_project_2025.system.notification.NotificationCategory;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.notification.audit.NotificationAuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailOutboxService {

    private static final int DEFAULT_MAX_RETRIES = 3;
    private static final int[] BACKOFF_MINUTES = {1, 5, 15};
    private static final Pattern BEARER_PATTERN = Pattern.compile(
            "(?i)(bearer)\\s+\\S+"
    );
    private static final Pattern SENSITIVE_PATTERN = Pattern.compile(
            "(?i)(password|passwd|secret|token|authorization|smtp[_-]?pass)\\s*[:=]\\s*\\S+"
    );

    private final EmailAttemptRepository attemptRepository;
    private final MailUtil mailUtil;

    @Autowired(required = false)
    private NotificationService notificationService;

    @Autowired(required = false)
    private NotificationAuditService auditService;

    @Value("${spring.mail.username:noreply@fams.local}")
    private String fromAddress;

    public record EnqueueCommand(
            Long tenantId,
            String idempotencyKey,
            String batchId,
            Long recipientUserId,
            String recipientEmail,
            NotificationCategory category,
            String templateCode,
            Integer templateVersion,
            String contextRef,
            String subject,
            String renderedBodyHtml,
            Long createdByUserId,
            boolean respectPreference
    ) {
    }

    @Transactional
    public EmailAttempt enqueue(EnqueueCommand command) {
        if (command == null || command.recipientEmail() == null || command.recipientEmail().isBlank()) {
            throw new BadRequestException("Recipient email is required");
        }
        String key = truncate(command.idempotencyKey(), 180);
        if (key == null || key.isBlank()) {
            throw new BadRequestException("Idempotency key is required");
        }

        Optional<EmailAttempt> existing = attemptRepository.findByIdempotencyKey(key);
        if (existing.isPresent()) {
            return existing.get();
        }

        NotificationCategory category = command.category() == null ? NotificationCategory.SYSTEM : command.category();
        boolean skipped = command.respectPreference()
                && command.recipientUserId() != null
                && notificationService != null
                && !notificationService.isEmailEnabled(command.recipientUserId(), category);

        EmailAttempt attempt = EmailAttempt.builder()
                .tenantId(command.tenantId())
                .idempotencyKey(key)
                .batchId(truncate(command.batchId(), 64))
                .recipientUserId(command.recipientUserId())
                .recipientEmail(command.recipientEmail().trim())
                .category(category)
                .templateCode(truncate(command.templateCode(), 100))
                .templateVersion(command.templateVersion())
                .contextRef(truncate(command.contextRef(), 120))
                .subject(truncate(command.subject(), 255))
                .renderedBodyHtml(command.renderedBodyHtml() == null ? "" : command.renderedBodyHtml())
                .deliveryStatus(skipped ? EmailDeliveryStatus.SKIPPED_BY_PREFERENCE : EmailDeliveryStatus.QUEUED)
                .retryCount(0)
                .maxRetries(DEFAULT_MAX_RETRIES)
                .nextRetryAt(skipped ? null : LocalDateTime.now())
                .lastError(skipped ? "Recipient disabled email notifications for " + category.name() : null)
                .correlationId(truncate(MDC.get("correlationId"), 64))
                .createdByUserId(command.createdByUserId())
                .build();

        try {
            return attemptRepository.saveAndFlush(attempt);
        } catch (DataIntegrityViolationException duplicate) {
            return attemptRepository.findByIdempotencyKey(key).orElseThrow(() -> duplicate);
        }
    }

    @Transactional
    public int processPendingBatch() {
        LocalDateTime now = LocalDateTime.now();
        List<EmailAttempt> due = attemptRepository
                .findTop50ByDeliveryStatusAndNextRetryAtLessThanEqualOrderByNextRetryAtAsc(
                        EmailDeliveryStatus.QUEUED,
                        now
                );
        int delivered = 0;
        for (EmailAttempt attempt : due) {
            if (dispatchSingle(attempt, now)) {
                delivered++;
            }
        }
        return delivered;
    }

    @Transactional
    public EmailAttempt retryFailed(Long attemptId, Long actorId, String actorEmail) {
        EmailAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Email attempt not found"));
        if (attempt.getDeliveryStatus() != EmailDeliveryStatus.FAILED) {
            throw new BadRequestException("Only FAILED email attempts can be retried");
        }
        attempt.setDeliveryStatus(EmailDeliveryStatus.QUEUED);
        attempt.setRetryCount(0);
        attempt.setNextRetryAt(LocalDateTime.now());
        attempt.setLastError(null);
        EmailAttempt saved = attemptRepository.save(attempt);
        if (auditService != null) {
            auditService.record(
                    saved.getTenantId(),
                    actorId,
                    actorEmail,
                    "EMAIL_RETRY_QUEUED",
                    "EmailAttempt",
                    String.valueOf(saved.getId()),
                    "FAILED",
                    "QUEUED"
            );
        }
        return saved;
    }

    private boolean dispatchSingle(EmailAttempt attempt, LocalDateTime now) {
        try {
            String sender = (fromAddress == null || fromAddress.isBlank()) ? "noreply@fams.local" : fromAddress;
            mailUtil.sendHtmlMail(attempt.getSubject(), sender, attempt.getRecipientEmail(), attempt.getRenderedBodyHtml());
            attempt.setDeliveryStatus(EmailDeliveryStatus.SENT);
            attempt.setSentAt(now);
            attempt.setNextRetryAt(null);
            attempt.setLastError(null);
            attemptRepository.save(attempt);
            log.info("Email outbox sent id={} to={} template={}", attempt.getId(), attempt.getRecipientEmail(), attempt.getTemplateCode());
            return true;
        } catch (Exception ex) {
            int nextCount = attempt.getRetryCount() + 1;
            attempt.setRetryCount(nextCount);
            attempt.setLastError(maskSensitiveError(ex.getMessage()));
            if (nextCount >= attempt.getMaxRetries()) {
                attempt.setDeliveryStatus(EmailDeliveryStatus.FAILED);
                attempt.setNextRetryAt(null);
                log.warn("Email outbox permanently FAILED id={} to={} retries={}: {}",
                        attempt.getId(), attempt.getRecipientEmail(), nextCount, attempt.getLastError());
            } else {
                int backoffIndex = Math.min(nextCount - 1, BACKOFF_MINUTES.length - 1);
                attempt.setDeliveryStatus(EmailDeliveryStatus.QUEUED);
                attempt.setNextRetryAt(now.plusMinutes(BACKOFF_MINUTES[backoffIndex]));
                log.warn("Email outbox retry scheduled id={} to={} attempt={}/{} nextRetryAt={}",
                        attempt.getId(), attempt.getRecipientEmail(), nextCount, attempt.getMaxRetries(), attempt.getNextRetryAt());
            }
            attemptRepository.save(attempt);
            return false;
        }
    }

    public static String maskSensitiveError(String raw) {
        if (raw == null || raw.isBlank()) {
            return "Email delivery failed";
        }
        String sanitized = BEARER_PATTERN.matcher(raw).replaceAll("$1 [REDACTED]");
        sanitized = SENSITIVE_PATTERN.matcher(sanitized).replaceAll("$1=[REDACTED]");
        return sanitized.length() <= 500 ? sanitized : sanitized.substring(0, 500);
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
