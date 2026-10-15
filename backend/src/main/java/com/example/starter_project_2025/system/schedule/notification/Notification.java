package com.example.starter_project_2025.system.schedule.notification;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "notifications")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("NOTIFICATION")
@ResourceMenu(
        title = "Notifications",
        group = "System Management",
        icon = "bell",
        url = "/notifications",
        order = 4,
        permission = "NOTIFICATION_READ"
)
public class Notification extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    Long userId;

    @Column(nullable = false, length = 150)
    String title;

    @Column(nullable = false, length = 500)
    String message;

    @Builder.Default
    @Column(name = "is_read", nullable = false)
    Boolean isRead = false;
}