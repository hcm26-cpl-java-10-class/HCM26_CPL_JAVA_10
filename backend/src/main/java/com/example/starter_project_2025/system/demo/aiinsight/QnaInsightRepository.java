package com.example.starter_project_2025.system.demo.aiinsight;

import com.example.starter_project_2025.system.demo.qna.LessonQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

/** Read-only queries used by the AI Q&A insight. Authors are intentionally not loaded (privacy). */
@Repository
public interface QnaInsightRepository extends JpaRepository<LessonQuestion, Long> {

    @Query("""
            select q from LessonQuestion q
              join fetch q.lesson lesson
              join fetch lesson.section section
            where section.course.id = :courseId
            order by lesson.id asc, q.id asc
            """)
    List<LessonQuestion> findByCourseId(@Param("courseId") Long courseId);

    /** Ids of the given questions that already have at least one answer. */
    @Query("select distinct a.question.id from LessonAnswer a where a.question.id in :ids")
    List<Long> findAnsweredQuestionIds(@Param("ids") Collection<Long> ids);
}