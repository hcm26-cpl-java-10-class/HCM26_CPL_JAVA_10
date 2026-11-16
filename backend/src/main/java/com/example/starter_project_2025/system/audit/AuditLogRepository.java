package com.example.starter_project_2025.system.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
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

    @Query("""
            SELECT a.createdAt, a.action, a.entityType, a.result, a.actorEmail
            FROM AuditLog a
            WHERE a.createdAt >= :rangeStart AND a.createdAt < :rangeEnd
            """)
    List<Object[]> findStatsRows(
            @Param("rangeStart") LocalDateTime rangeStart,
            @Param("rangeEnd") LocalDateTime rangeEnd
    );
}
