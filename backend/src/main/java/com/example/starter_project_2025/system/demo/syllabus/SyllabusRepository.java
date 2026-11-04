
package com.example.starter_project_2025.system.demo.syllabus;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SyllabusRepository
        extends JpaRepository<Syllabus, Long> {

    boolean existsByCodeIgnoreCase(String code);

    // Original M3 search for Admin / Teacher.
    @Query("""
            SELECT s FROM Syllabus s
            WHERE :q = ''
               OR LOWER(s.code) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(s.name) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY s.name ASC
            """)
    List<Syllabus> search(@Param("q") String query);

    // Published and active syllabuses only.
    // Used exclusively by the student catalog service.
    @Query("""
            SELECT s FROM Syllabus s
            WHERE s.status = :status
              AND s.isActive = true
              AND (
                  :q = ''
                  OR (
                      :field = 'code'
                      AND LOWER(s.code) LIKE :pattern
                  )
                  OR (
                      :field = 'name'
                      AND LOWER(s.name) LIKE :pattern
                  )
                  OR (
                      :field = 'all'
                      AND (
                          LOWER(s.code) LIKE :pattern
                          OR LOWER(s.name) LIKE :pattern
                      )
                  )
              )
            """)
    Page<Syllabus> searchPublished(
            @Param("status") SyllabusStatus status,
            @Param("q") String q,
            @Param("field") String field,
            @Param("pattern") String pattern,
            Pageable pageable
    );
}
