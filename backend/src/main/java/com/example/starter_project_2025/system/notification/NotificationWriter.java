package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Keeps a duplicate notification insert from rolling back the producer's business transaction. */
@Service
@RequiredArgsConstructor
public class NotificationWriter {
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void insert(Long userId, String eventKey, String title, String message, String targetUrl) {
        insert(userId, null, eventKey, title, message, targetUrl);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void insert(Long userId, Long tenantId, String eventKey, String title, String message, String targetUrl) {
        User userRef = userRepository.getReferenceById(userId);
        String correlationId = MDC.get("correlationId");
        if (correlationId != null && correlationId.length() > 64) {
            correlationId = correlationId.substring(0, 64);
        }
        notificationRepository.saveAndFlush(Notification.builder()
                .user(userRef)
                .tenantId(tenantId)
                .correlationId(correlationId)
                .eventKey(eventKey)
                .title(title)
                .message(message)
                .targetUrl(targetUrl)
                .category(NotificationCategory.fromEventKey(eventKey))
                .build());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void updateTargetUrl(Long userId, String eventKey, String targetUrl) {
        notificationRepository.updateTargetUrlByUserAndEventKey(userId, eventKey, targetUrl);
    }
}
