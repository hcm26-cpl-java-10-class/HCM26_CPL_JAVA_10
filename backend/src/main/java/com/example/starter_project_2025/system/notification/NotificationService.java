package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationWriter notificationWriter;

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
        try {
            notificationWriter.insert(userId, eventKey, title, message, targetUrl);
        } catch (DataIntegrityViolationException failure) {
            if (!notificationRepository.existsByUser_IdAndEventKey(userId, eventKey)) {
                throw failure;
            }
            notificationWriter.updateTargetUrl(userId, eventKey, targetUrl);
        }
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
