package com.example.starter_project_2025.system.notification.policy;

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

/**
 * Tenant-level notification policy governing mandatory channels and deduplication cooldown per category.
 * Uses {@code tenantId = 0L} as the default policy when a user is not assigned to a specific tenant.
 */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "tenant_notification_policies",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_tenant_notif_policy_tenant_cat",
                columnNames = {"tenant_id", "category"}
        )
)
public class TenantNotificationPolicy extends BaseEntity {

    public static final long DEFAULT_TENANT_ID = 0L;

    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    NotificationCategory category;

    @Builder.Default
    @Column(name = "in_app_mandatory", nullable = false)
    boolean inAppMandatory = false;

    @Builder.Default
    @Column(name = "email_mandatory", nullable = false)
    boolean emailMandatory = false;

    @Builder.Default
    @Column(name = "cooldown_minutes", nullable = false)
    int cooldownMinutes = 0;

    @Column(name = "updated_by_user_id")
    Long updatedByUserId;
}
