package com.example.starter_project_2025.system.schedule.notification;


import com.example.starter_project_2025.system.schedule.Session;
import com.example.starter_project_2025.system.schedule.SessionRepository;
import com.example.starter_project_2025.system.schedule.SessionStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionNotificationJob {

    SessionRepository sessionRepository;
    NotificationRepository notificationRepository;

    @Scheduled(fixedRate = 60000) // Chạy mỗi phút
    public void checkAndSendSessionNotifications() {
        LocalDateTime now = LocalDateTime.now();

        // 1. Thông báo trước 1 ngày
        LocalDateTime target1Day = now.plusDays(1);
        List<Session> sessions1Day = sessionRepository.findAll().stream()
                .filter(s -> s.getStartTime() != null &&
                        s.getStartTime().isAfter(target1Day.minusMinutes(1)) &&
                        s.getStartTime().isBefore(target1Day.plusMinutes(1)) &&
                        s.getStatus() == SessionStatus.SCHEDULED)
                .toList();

        for (Session session : sessions1Day) {
            createNotification(session.getTrainerId(),
                    "Nhắc lịch học ngày mai",
                    "Lớp " + session.getClassCode() + " có môn '" + session.getTitle() + "' vào ngày mai.");
        }

        // 2. Thông báo trước 15 phút
        LocalDateTime target15Min = now.plusMinutes(15);
        List<Session> sessions15Min = sessionRepository.findAll().stream()
                .filter(s -> s.getStartTime() != null &&
                        s.getStartTime().isAfter(target15Min.minusMinutes(1)) &&
                        s.getStartTime().isBefore(target15Min.plusMinutes(1)) &&
                        s.getStatus() == SessionStatus.SCHEDULED)
                .toList();

        for (Session session : sessions15Min) {
            createNotification(session.getTrainerId(),
                    "Sắp đến giờ học",
                    "Buổi học '" + session.getTitle() + "' tại phòng " + session.getRoom() + " sẽ bắt đầu sau 15 phút nữa.");
        }

        // 3. Thông báo lố giờ 5 phút
        LocalDateTime targetLate = now.minusMinutes(5);
        List<Session> sessionsLate = sessionRepository.findAll().stream()
                .filter(s -> s.getStartTime() != null &&
                        s.getStartTime().isAfter(targetLate.minusMinutes(1)) &&
                        s.getStartTime().isBefore(targetLate.plusMinutes(1)) &&
                        s.getStatus() == SessionStatus.SCHEDULED)
                .toList();

        for (Session session : sessionsLate) {
            createNotification(session.getTrainerId(),
                    "Cảnh báo trễ giờ",
                    "Buổi học '" + session.getTitle() + "' của lớp " + session.getClassCode() + " đã bắt đầu trễ 5 phút.");
        }
    }

    private void createNotification(Long userId, String title, String message) {
        if (userId == null) return;
        Notification notification = Notification.builder()
                .userId(userId)
                .title(title)
                .message(message)
                .isRead(false)
                .isActive(true)
                .build();
        notificationRepository.save(notification);
        log.info("[NOTIFICATION CREATED] User ID: {} - Title: {}", userId, title);
    }
}