package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
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
        notificationRepository.saveAndFlush(Notification.builder()
                .user(userRepository.getReferenceById(userId))
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
