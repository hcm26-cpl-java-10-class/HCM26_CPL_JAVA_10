package com.example.starter_project_2025.system.auth.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface AuthAuditRepository extends JpaRepository<AuthAuditLog, Long> {

    @Query("""
            select a from AuthAuditLog a
            where (:action is null or a.action = :action)
              and (:email is null or lower(coalesce(a.actorEmail, '')) like lower(concat('%', :email, '%')))
            order by a.createdAt desc, a.id desc
            """)
    Page<AuthAuditLog> search(
            @Param("action") AuthAuditAction action,
            @Param("email") String email,
            Pageable pageable
    );
}
