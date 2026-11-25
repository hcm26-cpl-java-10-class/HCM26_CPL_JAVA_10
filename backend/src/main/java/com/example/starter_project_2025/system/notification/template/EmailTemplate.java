package com.example.starter_project_2025.system.notification.template;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.notification.NotificationCategory;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "email_templates",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_email_template_tenant_code",
                columnNames = {"tenant_id", "code"}
        )
)
public class EmailTemplate extends BaseEntity {

    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

    @Column(nullable = false, length = 80)
    String code;

    @Column(nullable = false, length = 150)
    String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    NotificationCategory category;

    @Column(length = 500)
    String description;

    @Builder.Default
    @Column(nullable = false)
    boolean active = true;

    @Builder.Default
    @Column(name = "current_version", nullable = false)
    int currentVersion = 1;

    @Column(name = "subject_template", nullable = false, length = 255)
    String subjectTemplate;

    @Column(name = "body_html", columnDefinition = "TEXT", nullable = false)
    String bodyHtml;

    @Column(name = "sample_variables_json", columnDefinition = "TEXT")
    String sampleVariablesJson;

    @Builder.Default
    @Column(name = "system_seeded", nullable = false)
    boolean systemSeeded = false;

    @Column(name = "updated_by_user_id")
    Long updatedByUserId;
}
