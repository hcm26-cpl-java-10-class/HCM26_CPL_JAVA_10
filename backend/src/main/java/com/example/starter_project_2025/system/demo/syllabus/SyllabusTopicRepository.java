package com.example.starter_project_2025.system.demo.syllabus;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SyllabusTopicRepository
        extends JpaRepository<SyllabusTopic, Long> {

    List<SyllabusTopic> findBySection_IdOrderByOrderIndexAsc(
            Long sectionId
    );

    long countBySection_Id(Long sectionId);
}