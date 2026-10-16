package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LessonRepository extends BaseCrudRepository<Lesson, Long> {

    List<Lesson> findBySection_IdOrderByOrderIndexAsc(Long sectionId);

    @Query("""
            select lesson
            from Lesson lesson
            join fetch lesson.section section
            where section.course.id = :courseId
            order by section.orderIndex asc, lesson.orderIndex asc
            """)
    List<Lesson> findByCourseIdOrdered(@Param("courseId") Long courseId);
}
