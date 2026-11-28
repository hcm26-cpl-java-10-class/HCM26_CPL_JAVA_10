package com.example.starter_project_2025.system.audit.guard;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface SecurityAlertRepository extends JpaRepository<SecurityAlert, Long> {

    Optional<SecurityAlert> findFirstBySubjectKeyAndTypeAndStatusOrderByCreatedAtDesc(
            String subjectKey, String type, String status);

    Page<SecurityAlert> findByStatus(String status, Pageable pageable);

    long countByStatus(String status);

    @Modifying
    @Query("update SecurityAlert a set a.status = :status, a.resolvedAt = :now, a.resolvedBy = :by "
            + "where a.userId = :userId and a.status = 'OPEN'")
    int resolveOpenForUser(@Param("userId") Long userId,
                           @Param("status") String status,
                           @Param("now") LocalDateTime now,
                           @Param("by") String by);
}
