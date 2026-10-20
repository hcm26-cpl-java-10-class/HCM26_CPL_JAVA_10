package com.example.starter_project_2025.system.demo.syllabus;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SyllabusSectionRepository
        extends JpaRepository<SyllabusSection, Long> {

    List<SyllabusSection> findBySyllabus_IdOrderByOrderIndexAsc(
            Long syllabusId
    );

    long countBySyllabus_Id(Long syllabusId);
}