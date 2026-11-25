package com.example.starter_project_2025.system.notification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {

    List<NotificationPreference> findByUser_Id(Long userId);

    Optional<NotificationPreference> findByUser_IdAndCategory(Long userId, NotificationCategory category);
}
