package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public NotificationListDTO getForUser(Long userId) {
        return new NotificationListDTO(
                notificationRepository.findTop30ByUser_IdOrderByCreatedAtDesc(userId)
                        .stream()
                        .map(NotificationDTO::from)
                        .toList(),
                notificationRepository.countByUser_IdAndReadAtIsNull(userId)
        );
    }

    @Transactional
    public void createOnce(Long userId, String eventKey, String title, String message, String targetUrl) {
        if (notificationRepository.existsByEventKey(eventKey)) {
            return;
        }
        notificationRepository.save(Notification.builder()
                .user(userRepository.getReferenceById(userId))
                .eventKey(eventKey)
                .title(title)
                .message(message)
                .targetUrl(targetUrl)
                .build());
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
}

