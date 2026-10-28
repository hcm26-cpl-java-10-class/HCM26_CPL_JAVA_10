package com.example.starter_project_2025.system.demo.report;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CourseReportRepository extends JpaRepository<CourseEnrollment, Long> {

    @Query("""
        select e
        from CourseEnrollment e
        join fetch e.user u
        join fetch e.course c
        where c.id = :courseId
        order by e.createdAt desc
    """)
    List<CourseEnrollment> findByCourseIdWithUser(@Param("courseId") Long courseId);

    @Query("""
        select distinct c
        from Course c
        left join fetch c.categories cat
        order by c.name asc
    """)
    List<Course> findAllCoursesWithMeta();

    @Query("""
        select distinct c
        from Course c
        left join fetch c.categories cat
        where c.instructorUser.id = :userId
           or c.createdBy = :userId
           or (c.instructor is not null and lower(trim(c.instructor)) = lower(trim(:fullName)))
           or (c.instructor is not null and lower(trim(c.instructor)) = lower(trim(:email)))
        order by c.name asc
    """)
    List<Course> findCoursesByTeacher(
            @Param("userId") Long userId,
            @Param("fullName") String fullName,
            @Param("email") String email
    );
}
