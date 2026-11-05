package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
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

    /** Bài học đang active của khóa học, theo thứ tự Section rồi Lesson (dùng cho trang chi tiết). */
    @Query("""
            select lesson
            from Lesson lesson
            join fetch lesson.section section
            where section.course.id = :courseId
              and lesson.isActive = true
              and section.isActive = true
            order by section.orderIndex asc, lesson.orderIndex asc, lesson.id asc
            """)
    List<Lesson> findActiveByCourseIdOrdered(@Param("courseId") Long courseId);

    /** Số bài học và tổng thời lượng theo từng khóa học (dùng cho Catalog). */
    @Query("""
            select new com.example.starter_project_2025.system.demo.lesson.CourseLessonStats(
                section.course.id, count(lesson), coalesce(sum(lesson.duration), 0L))
            from Lesson lesson
            join lesson.section section
            where section.course.id in :courseIds
              and lesson.isActive = true
              and section.isActive = true
            group by section.course.id
            """)
    List<CourseLessonStats> findStatsByCourseIds(@Param("courseIds") Collection<Long> courseIds);
}
