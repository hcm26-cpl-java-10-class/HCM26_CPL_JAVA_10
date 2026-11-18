package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

import static lombok.AccessLevel.PRIVATE;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = PRIVATE)
@Table(
        name = "user_notifications",
        indexes = @Index(name = "idx_notification_user_created", columnList = "user_id, created_at")
)
public class Notification extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    User user;

    @Column(name = "event_key", nullable = false, unique = true, updatable = false, length = 180)
    String eventKey;

    @Column(nullable = false, length = 120)
    String title;

    @Column(nullable = false, length = 500)
    String message;

    @Column(name = "target_url", length = 500)
    String targetUrl;

    @Column(name = "read_at")
    LocalDateTime readAt;
}

