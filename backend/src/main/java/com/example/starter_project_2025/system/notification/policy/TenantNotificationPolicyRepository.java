package com.example.starter_project_2025.system.notification.policy;

import com.example.starter_project_2025.system.notification.NotificationCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TenantNotificationPolicyRepository extends JpaRepository<TenantNotificationPolicy, Long> {

    List<TenantNotificationPolicy> findByTenantId(Long tenantId);

    Optional<TenantNotificationPolicy> findByTenantIdAndCategory(Long tenantId, NotificationCategory category);
}
