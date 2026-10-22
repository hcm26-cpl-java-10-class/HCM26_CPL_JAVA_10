package com.example.starter_project_2025.system.demo.syllabus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SyllabusRepository extends JpaRepository<Syllabus, Long> {

    boolean existsByCodeIgnoreCase(String code);

    @Query("""
            SELECT s FROM Syllabus s
            WHERE :q = ''
               OR LOWER(s.code) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(s.name) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY s.name ASC
            """)
    List<Syllabus> search(@Param("q") String query);
}