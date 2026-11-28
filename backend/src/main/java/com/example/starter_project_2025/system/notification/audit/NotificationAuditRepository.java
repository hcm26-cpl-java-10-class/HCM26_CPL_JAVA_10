package com.example.starter_project_2025.system.notification.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationAuditRepository extends JpaRepository<NotificationAuditLog, Long> {

    Page<NotificationAuditLog> findByTenantIdOrderByCreatedAtDesc(Long tenantId, Pageable pageable);
}
