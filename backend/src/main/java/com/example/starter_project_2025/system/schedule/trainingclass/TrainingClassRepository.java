package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TrainingClassRepository
        extends BaseCrudRepository<TrainingClass, Long> {

    boolean existsByCode(String code);
    Page<TrainingClass> findByCodeContainingIgnoreCaseOrNameContainingIgnoreCase(
            String code,
            String name,
            Pageable pageable
    );
    boolean existsByCodeAndIdNot(String code, Long id);
    @Query("""
        SELECT c FROM TrainingClass c
            WHERE c.isActive = true
               AND (
            LOWER(c.code) LIKE LOWER(CONCAT('%', :search, '%'))
            OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%'))
        )
        AND (:status IS NULL OR c.status = :status)
        AND (:site = '' OR LOWER(c.site) = LOWER(:site))
        """)
    Page<TrainingClass> searchClasses(
            @Param("search") String search,
            @Param("status") ClassStatus status,
            @Param("site") String site,
            Pageable pageable);
}