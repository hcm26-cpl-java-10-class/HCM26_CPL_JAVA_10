package com.example.starter_project_2025.system.demo.syllabus;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SyllabusMaterialRepository
        extends JpaRepository<SyllabusMaterial, Long> {

    List<SyllabusMaterial> findBySyllabus_IdOrderByIdAsc(
            Long syllabusId
    );

    long countBySyllabus_Id(Long syllabusId);

    long countByTopic_Id(Long topicId);
}