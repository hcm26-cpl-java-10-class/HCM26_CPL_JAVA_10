package com.example.starter_project_2025.system.learning.report;

import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.Optional;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import static com.example.starter_project_2025.system.learning.report.ReportData.Type;

interface LearningReportRepository extends JpaRepository<LearningReport,Long> {
    Optional<LearningReport> findByIdAndOwnerId(Long id, Long owner);
    Optional<LearningReport> findByOwnerIdAndRequestKey(Long owner, String key);
    Optional<LearningReport> findFirstByOwnerIdOrderByGeneratedAtDescIdDesc(Long owner);
    long countByOwnerId(Long owner);
    long countByOwnerIdAndGeneratedAtGreaterThanEqual(Long owner, Instant from);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from LearningReport r where r.id = :id and r.ownerId = :owner")
    Optional<LearningReport> lockOwned(Long id, Long owner);

    @Query("""
        select r from LearningReport r where r.ownerId = :owner
        and (:type is null or r.type = :type)
        and r.periodStart <= :to and r.periodEnd >= :from
        """)
    Page<LearningReport> search(Long owner, Type type, LocalDate from, LocalDate to, Pageable page);
}
