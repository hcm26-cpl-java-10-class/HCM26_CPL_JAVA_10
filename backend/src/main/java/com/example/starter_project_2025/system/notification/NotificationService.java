package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.notification.audit.NotificationAuditService;
import com.example.starter_project_2025.system.notification.policy.TenantNotificationPolicyDTO;
import com.example.starter_project_2025.system.notification.policy.TenantNotificationPolicyService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationWriter notificationWriter;

    /** Optional so the two-argument constructor used by older tests keeps working; null means "no preferences". */
    @Autowired(required = false)
    private NotificationPreferenceRepository preferenceRepository;

    @Autowired(required = false)
    private UserRepository userRepository;

    @Autowired(required = false)
    private TenantNotificationPolicyService policyService;

    @Autowired(required = false)
    private NotificationAuditService auditService;

    @Transactional(readOnly = true)
    public NotificationListDTO getForUser(Long userId, int page, int size) {
        var notifications = notificationRepository.findByUser_IdOrderByCreatedAtDesc(
                userId,
                PageRequest.of(page, size)
        );
        return new NotificationListDTO(
                notifications.stream()
                        .map(NotificationDTO::from)
                        .toList(),
                notificationRepository.countByUser_IdAndReadAtIsNull(userId),
                notifications.getNumber(),
                notifications.getTotalPages(),
                notifications.getTotalElements()
        );
    }

    public void createOnce(Long userId, String eventKey, String title, String message, String targetUrl) {
        if (notificationRepository.existsByUser_IdAndEventKey(userId, eventKey)) {
            notificationWriter.updateTargetUrl(userId, eventKey, targetUrl);
            return;
        }
        NotificationCategory category = NotificationCategory.fromEventKey(eventKey);
        Long tenantId = resolveTenantId(userId);
        if (!isInAppEnabled(userId, tenantId, category)) {
            return;
        }
        try {
            notificationWriter.insert(userId, tenantId, eventKey, title, message, targetUrl);
        } catch (DataIntegrityViolationException failure) {
            if (!notificationRepository.existsByUser_IdAndEventKey(userId, eventKey)) {
                throw failure;
            }
            notificationWriter.updateTargetUrl(userId, eventKey, targetUrl);
        }
    }

    /**
     * Creates an in-app notification with both exact {@code eventKey} deduplication and a time-based
     * cooldown window keyed by {@code cooldownPrefix}. If the tenant policy defines a larger cooldown
     * for the category, the larger window takes effect.
     */
    public void createOnceWithCooldown(
            Long userId,
            String eventKey,
            String cooldownPrefix,
            Duration cooldown,
            String title,
            String message,
            String targetUrl
    ) {
        NotificationCategory category = NotificationCategory.fromEventKey(eventKey);
        Long tenantId = resolveTenantId(userId);
        Duration effectiveCooldown = resolveEffectiveCooldown(tenantId, category, cooldown);
        if (cooldownPrefix != null && !cooldownPrefix.isBlank()
                && effectiveCooldown != null && !effectiveCooldown.isZero() && !effectiveCooldown.isNegative()) {
            LocalDateTime cutoff = LocalDateTime.now().minus(effectiveCooldown);
            List<Notification> recent = notificationRepository.findByEventKeyStartingWithOrderByCreatedAtDesc(cooldownPrefix);
            boolean withinCooldown = recent.stream()
                    .anyMatch(n -> n.getUser() != null
                            && userId.equals(n.getUser().getId())
                            && n.getCreatedAt() != null
                            && n.getCreatedAt().isAfter(cutoff));
            if (withinCooldown) {
                return;
            }
        }
        createOnce(userId, eventKey, title, message, targetUrl);
    }

    @Transactional(readOnly = true)
    public boolean isEmailEnabled(Long userId, NotificationCategory category) {
        if (userId == null) {
            return true;
        }
        NotificationCategory safeCategory = category == null ? NotificationCategory.SYSTEM : category;
        Long tenantId = resolveTenantId(userId);
        if (policyService != null && policyService.isEmailMandatory(tenantId, safeCategory)) {
            return true;
        }
        if (preferenceRepository == null) {
            return true;
        }
        return preferenceRepository.findByUser_IdAndCategory(userId, safeCategory)
                .map(NotificationPreference::isEmailEnabledEffective)
                .orElse(true);
    }

    @Transactional
    public void markRead(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndUser_Id(notificationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
        }
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllRead(userId, LocalDateTime.now());
    }

    @Transactional(readOnly = true)
    public NotificationPageDTO getPage(Long userId, NotificationCategory category, boolean unreadOnly, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest request = PageRequest.of(Math.max(page, 0), safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));
        Page<Notification> result;
        if (category == null) {
            result = unreadOnly
                    ? notificationRepository.findByUser_IdAndReadAtIsNull(userId, request)
                    : notificationRepository.findByUser_Id(userId, request);
        } else {
            result = unreadOnly
                    ? notificationRepository.findByUser_IdAndCategoryAndReadAtIsNull(userId, category, request)
                    : notificationRepository.findByUser_IdAndCategory(userId, category, request);
        }
        Map<NotificationCategory, Long> byCategory = unreadByCategory(userId);
        long unread = byCategory.values().stream().mapToLong(Long::longValue).sum();
        return new NotificationPageDTO(
                result.getContent().stream().map(NotificationDTO::from).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages(),
                unread, byCategory);
    }

    @Transactional(readOnly = true)
    public Map<NotificationCategory, Long> unreadByCategory(Long userId) {
        Map<NotificationCategory, Long> counts = new EnumMap<>(NotificationCategory.class);
        for (NotificationCategory category : NotificationCategory.values()) {
            counts.put(category, 0L);
        }
        for (Object[] row : notificationRepository.countUnreadByCategory(userId)) {
            NotificationCategory category = row[0] == null ? NotificationCategory.SYSTEM : (NotificationCategory) row[0];
            counts.merge(category, (Long) row[1], Long::sum);
        }
        return counts;
    }

    @Transactional
    public void delete(Long userId, Long notificationId) {
        if (notificationRepository.deleteOwned(notificationId, userId) == 0) {
            throw new ResourceNotFoundException("Notification not found");
        }
    }

    @Transactional
    public int deleteRead(Long userId) {
        return notificationRepository.deleteRead(userId);
    }

    @Transactional(readOnly = true)
    public List<NotificationPreferenceDTO> getPreferences(Long userId) {
        Map<NotificationCategory, NotificationPreference> stored = new EnumMap<>(NotificationCategory.class);
        if (preferenceRepository != null) {
            preferenceRepository.findByUser_Id(userId)
                    .forEach(p -> stored.put(p.getCategory(), p));
        }
        Long tenantId = resolveTenantId(userId);
        return java.util.Arrays.stream(NotificationCategory.values())
                .map(c -> {
                    NotificationPreference pref = stored.get(c);
                    TenantNotificationPolicyDTO policy = policyService != null
                            ? policyService.getEffectivePolicy(tenantId, c)
                            : new TenantNotificationPolicyDTO(c, false, false, 0);
                    boolean inApp = policy.inAppMandatory() || (pref == null || pref.isInAppEnabled());
                    boolean email = policy.emailMandatory() || (pref == null || pref.isEmailEnabledEffective());
                    return new NotificationPreferenceDTO(c, inApp, email, policy.inAppMandatory(), policy.emailMandatory());
                })
                .toList();
    }

    @Transactional
    public List<NotificationPreferenceDTO> updatePreferences(Long userId, List<NotificationPreferenceDTO> changes) {
        if (preferenceRepository == null || changes == null) {
            return getPreferences(userId);
        }
        Long tenantId = resolveTenantId(userId);
        String actorEmail = resolveUserEmail(userId);

        for (NotificationPreferenceDTO change : changes) {
            if (change == null || change.category() == null) {
                continue;
            }
            NotificationCategory category = change.category();
            TenantNotificationPolicyDTO policy = policyService != null
                    ? policyService.getEffectivePolicy(tenantId, category)
                    : new TenantNotificationPolicyDTO(category, false, false, 0);

            if (policy.inAppMandatory() && !change.inAppEnabled()) {
                throw new ResponseStatusException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "In-app notifications for " + category.name() + " are required by tenant policy"
                );
            }
            if (policy.emailMandatory() && Boolean.FALSE.equals(change.emailEnabled())) {
                throw new ResponseStatusException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "Email notifications for " + category.name() + " are required by tenant policy"
                );
            }

            NotificationPreference existing = preferenceRepository.findByUser_IdAndCategory(userId, category)
                    .orElse(null);
            String beforeState = existing == null
                    ? "inApp=true,email=true"
                    : "inApp=" + existing.isInAppEnabled() + ",email=" + existing.isEmailEnabledEffective();

            NotificationPreference row = existing != null
                    ? existing
                    : NotificationPreference.builder()
                            .user(userRepository.getReferenceById(userId))
                            .category(category)
                            .inAppEnabled(true)
                            .emailEnabled(true)
                            .build();
            row.setInAppEnabled(change.inAppEnabled());
            if (change.emailEnabled() != null) {
                row.setEmailEnabled(change.emailEnabled());
            } else if (row.getEmailEnabled() == null) {
                row.setEmailEnabled(true);
            }
            preferenceRepository.save(row);

            if (auditService != null) {
                auditService.record(
                        tenantId,
                        userId,
                        actorEmail,
                        "PREFERENCE_UPDATED",
                        "NotificationPreference",
                        userId + ":" + category.name(),
                        beforeState,
                        "inApp=" + row.isInAppEnabled() + ",email=" + row.isEmailEnabledEffective()
                );
            }
        }
        return getPreferences(userId);
    }

    /** One-off at startup: give old rows a category derived from their event key. */
    @Transactional
    public int backfillCategories() {
        List<Notification> rows = notificationRepository.findByCategoryIsNull();
        rows.forEach(n -> n.setCategory(NotificationCategory.fromEventKey(n.getEventKey())));
        return rows.size();
    }

    private boolean isInAppEnabled(Long userId, Long tenantId, NotificationCategory category) {
        if (policyService != null && policyService.isInAppMandatory(tenantId, category)) {
            return true;
        }
        if (preferenceRepository == null) {
            return true;
        }
        return preferenceRepository.findByUser_IdAndCategory(userId, category)
                .map(NotificationPreference::isInAppEnabled)
                .orElse(true);
    }

    private Duration resolveEffectiveCooldown(Long tenantId, NotificationCategory category, Duration requested) {
        Duration policyCooldown = Duration.ZERO;
        if (policyService != null) {
            int minutes = policyService.getEffectivePolicy(tenantId, category).cooldownMinutes();
            if (minutes > 0) {
                policyCooldown = Duration.ofMinutes(minutes);
            }
        }
        if (requested == null || requested.isNegative()) {
            return policyCooldown;
        }
        return requested.compareTo(policyCooldown) >= 0 ? requested : policyCooldown;
    }

    private Long resolveTenantId(Long userId) {
        if (userRepository == null || userId == null) {
            return null;
        }
        return userRepository.findById(userId)
                .map(User::getTenantId)
                .orElse(null);
    }

    private String resolveUserEmail(Long userId) {
        if (userRepository == null || userId == null) {
            return null;
        }
        return userRepository.findById(userId)
                .map(User::getEmail)
                .orElse(null);
    }
}
