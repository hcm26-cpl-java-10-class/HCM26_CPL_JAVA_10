package com.example.starter_project_2025.system.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Page<Notification> findByUser_IdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    long countByUser_IdAndReadAtIsNull(Long userId);

    Optional<Notification> findByIdAndUser_Id(Long id, Long userId);

    boolean existsByUser_IdAndEventKey(Long userId, String eventKey);

    /** Thông báo có eventKey bắt đầu bằng prefix (mới nhất trước) - dùng cho cooldown nhắc học. */
    List<Notification> findByEventKeyStartingWithOrderByCreatedAtDesc(String prefix);

    @Modifying
    @Query("update Notification notification set notification.targetUrl = :targetUrl "
            + "where notification.user.id = :userId and notification.eventKey = :eventKey")
    int updateTargetUrlByUserAndEventKey(@Param("userId") Long userId,
                                         @Param("eventKey") String eventKey,
                                         @Param("targetUrl") String targetUrl);

    @Modifying
    @Query("update Notification notification set notification.readAt = :readAt "
            + "where notification.user.id = :userId and notification.readAt is null")
    int markAllRead(@Param("userId") Long userId, @Param("readAt") LocalDateTime readAt);
}
