package com.example.starter_project_2025.system.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findTop30ByUser_IdOrderByCreatedAtDesc(Long userId);

    long countByUser_IdAndReadAtIsNull(Long userId);

    Optional<Notification> findByIdAndUser_Id(Long id, Long userId);

    boolean existsByEventKey(String eventKey);

    @Modifying
    @Query("update Notification notification set notification.readAt = :readAt "
            + "where notification.user.id = :userId and notification.readAt is null")
    int markAllRead(@Param("userId") Long userId, @Param("readAt") LocalDateTime readAt);
}

