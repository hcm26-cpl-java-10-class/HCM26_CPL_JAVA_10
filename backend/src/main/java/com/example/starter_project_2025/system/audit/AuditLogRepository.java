package com.example.starter_project_2025.system.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository
        extends JpaRepository<AuditLog, Long>,
        JpaSpecificationExecutor<AuditLog> {

    Page<AuditLog> findByEntityTypeAndEntityId(
            String entityType,
            String entityId,
            Pageable pageable
    );

    @Query("""
            SELECT DISTINCT a.action
            FROM AuditLog a
            WHERE a.action IS NOT NULL
            ORDER BY a.action
            """)
    List<String> findDistinctActions();

    @Query("""
            SELECT DISTINCT a.entityType
            FROM AuditLog a
            WHERE a.entityType IS NOT NULL
            ORDER BY a.entityType
            """)
    List<String> findDistinctEntityTypes();
}
