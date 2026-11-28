package com.example.starter_project_2025.system.demo.bookmark;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CourseBookmarkRepository extends JpaRepository<CourseBookmark, Long> {

    boolean existsByUserIdAndCourseId(Long userId, Long courseId);

    @Query("""
            select cb.courseId
            from CourseBookmark cb
            join Course c on c.id = cb.courseId
            where cb.userId = :userId
              and cb.isActive = true
              and c.isActive = true
              and c.status = com.example.starter_project_2025.system.demo.course.CourseStatus.PUBLISHED
            order by cb.createdAt desc, cb.id desc
            """)
    List<Long> findSavedCourseIdsByUserId(@Param("userId") Long userId);

    void deleteByUserIdAndCourseId(Long userId, Long courseId);
}
