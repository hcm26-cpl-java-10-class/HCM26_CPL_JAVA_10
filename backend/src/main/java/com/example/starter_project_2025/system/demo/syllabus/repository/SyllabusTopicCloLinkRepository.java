package com.example.starter_project_2025.system.demo.syllabus.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusTopicCloLink;

public interface SyllabusTopicCloLinkRepository extends JpaRepository<SyllabusTopicCloLink, Long> {

    @Query("""
            SELECT link FROM SyllabusTopicCloLink link
            JOIN FETCH link.topic t
            JOIN FETCH link.clo c
            WHERE t.section.syllabus.id = :syllabusId
            ORDER BY t.id ASC, c.orderIndex ASC
            """)
    List<SyllabusTopicCloLink> findAllForSyllabus(@Param("syllabusId") Long syllabusId);

    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM SyllabusTopicCloLink link WHERE link.topic.id = :topicId")
    int deleteAllForTopic(@Param("topicId") Long topicId);

    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM SyllabusTopicCloLink link WHERE link.clo.id = :cloId")
    int deleteAllForClo(@Param("cloId") Long cloId);
}
