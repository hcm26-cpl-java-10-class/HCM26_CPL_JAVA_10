package com.example.starter_project_2025.system.audit.guard;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.audit.AuditLogService;
import com.example.starter_project_2025.system.audit.AuditSupport;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class SecurityAlertService {

    private static final String TARGET_URL = "/admin/audit-log?view=security";

    private final SecurityAlertRepository alertRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;

    /** While an alert for the same caller is open and newer than this, repeats only bump a counter. */
    @Value("${app.security.alert.cooldown-minutes:30}")
    private long cooldownMinutes;

    @Transactional
    public void raise(
            RequestAbuseDetector.Detection detection,
            String subjectKey,
            Long userId,
            String email,
            String ip,
            String path
    ) {
        LocalDateTime now = LocalDateTime.now();

        SecurityAlert open = alertRepository
                .findFirstBySubjectKeyAndTypeAndStatusOrderByCreatedAtDesc(
                        subjectKey, detection.type(), SecurityAlert.STATUS_OPEN)
                .filter(a -> a.getLastSeenAt().isAfter(now.minusMinutes(cooldownMinutes)))
                .orElse(null);

        if (open != null) {
            open.setHits(open.getHits() + 1);
            open.setLastSeenAt(now);
            open.setRequestCount(Math.max(open.getRequestCount(), detection.count()));
            open.setLastPath(trim(path, 255));
            return;
        }

        SecurityAlert alert = alertRepository.save(SecurityAlert.builder()
                .type(detection.type())
                .status(SecurityAlert.STATUS_OPEN)
                .subjectKey(subjectKey)
                .userId(userId)
                .userEmail(email)
                .ipAddress(ip)
                .requestCount(detection.count())
                .windowSeconds(detection.windowSeconds())
                .lastPath(trim(path, 255))
                .hits(1)
                .lastSeenAt(now)
                .build());

        String who = email != null ? email : "IP " + ip;
        String title = SecurityAlert.TYPE_RATE_LIMIT.equals(detection.type())
                ? "Suspicious request spam"
                : "Repeated unauthorized access";
        String message = SecurityAlert.TYPE_RATE_LIMIT.equals(detection.type())
                ? who + " sent " + detection.count() + " requests in "
                        + detection.windowSeconds() + "s. Review and block if needed."
                : who + " was denied " + detection.count() + " times in "
                        + detection.windowSeconds() + "s. Review and block if needed.";

        for (User admin : userRepository.findActiveAdmins()) {
            notificationService.createOnce(
                    admin.getId(),
                    "security-alert:" + alert.getId() + ":" + admin.getId(),
                    title,
                    trim(message, 500),
                    TARGET_URL);
        }

        auditLogService.logAs(
                userId, email != null ? email : "ip:" + ip,
                "SECURITY_ALERT", "SECURITY_ALERT", String.valueOf(alert.getId()),
                null,
                AuditSupport.json(
                        "type", detection.type(),
                        "requests", detection.count(),
                        "windowSeconds", detection.windowSeconds(),
                        "ip", ip,
                        "path", path),
                null, "SUCCESS");
    }

    @Transactional(readOnly = true)
    public Page<SecurityAlertDTO> list(String status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "lastSeenAt"));
        Page<SecurityAlert> result = status == null || status.isBlank()
                ? alertRepository.findAll(pageable)
                : alertRepository.findByStatus(status.trim().toUpperCase(), pageable);

        return result.map(a -> SecurityAlertDTO.from(a, blockedUntilOf(a.getUserId())));
    }

    @Transactional(readOnly = true)
    public long countOpen() {
        return alertRepository.countByStatus(SecurityAlert.STATUS_OPEN);
    }

    @Transactional
    public void dismiss(Long alertId, Long adminId, String adminEmail) {
        SecurityAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ResourceNotFoundException("Security alert not found"));

        if (!SecurityAlert.STATUS_OPEN.equals(alert.getStatus())) {
            return;
        }

        alert.setStatus(SecurityAlert.STATUS_DISMISSED);
        alert.setResolvedAt(LocalDateTime.now());
        alert.setResolvedBy(adminEmail);

        auditLogService.logAs(adminId, adminEmail, "DISMISS", "SECURITY_ALERT",
                String.valueOf(alertId), null, null, null, "SUCCESS");
    }

    private LocalDateTime blockedUntilOf(Long userId) {
        if (userId == null) {
            return null;
        }

        return userRepository.findById(userId)
                .filter(User::isTemporarilyBlocked)
                .map(User::getBlockedUntil)
                .orElse(null);
    }

    private static String trim(String value, int max) {
        if (value == null) {
            return null;
        }

        return value.length() <= max ? value : value.substring(0, max);
    }
}
