package com.example.starter_project_2025.system.notification.template;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/** Immutable snapshot of each published email template revision so historical emails never mutate. */
@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "email_template_versions",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_email_template_version",
                columnNames = {"template_id", "version"}
        )
)
public class EmailTemplateVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "template_id", nullable = false)
    Long templateId;

    @Column(nullable = false)
    int version;

    @Column(name = "subject_template", nullable = false, length = 255)
    String subjectTemplate;

    @Column(name = "body_html", columnDefinition = "TEXT", nullable = false)
    String bodyHtml;

    @Column(name = "change_note", length = 300)
    String changeNote;

    @Column(name = "created_by_user_id")
    Long createdByUserId;

    @Column(name = "created_at", nullable = false)
    LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
