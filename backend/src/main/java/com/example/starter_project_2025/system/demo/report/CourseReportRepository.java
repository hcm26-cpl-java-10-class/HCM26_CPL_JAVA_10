package com.example.starter_project_2025.system.demo.report;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
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

    // =================================================================
    // Learning hours analytics
    // =================================================================

    /**
     * [userId, departmentId, departmentName] cho mọi quan hệ user - phòng ban.
     *
     * <p>Một học viên có thể thuộc nhiều phòng ban nên có thể xuất hiện nhiều dòng.
     */
    @Query("""
        select u.id, d.id, d.name
        from User u
          join u.departments d
        where u.id in :userIds
        """)
    List<Object[]> findUserDepartments(@Param("userIds") Collection<Long> userIds);

    /**
     * [enrollmentId, userId, studentName, studentEmail,
     *  courseId, courseName, enrolledAt, lastAccessedAt,
     *  completedLessons, totalLessons, studySeconds]
     *
     * <p>{@code studySeconds} là tổng thời gian học của học viên trong riêng
     * lượt đăng ký này. Người học chưa mở bài nào vẫn xuất hiện (studySeconds = 0).
     *
     * <p>Phòng ban được gắn ở tầng service (một học viên có thể thuộc nhiều phòng ban,
     * chọn phòng ban chính để tránh đếm trùng giờ học).
     */
    @Query("""
        select e.id, u.id,
               concat(coalesce(u.firstName, ''), ' ', coalesce(u.lastName, '')),
               u.email,
               c.id, c.name, e.createdAt, e.lastAccessedAt,
               (select count(p) from LessonProgress p
                 where p.enrollment = e and p.completed = true),
               (select count(l) from Lesson l
                 join l.section sec
                 where sec.course = c and l.isActive = true and sec.isActive = true),
               (select coalesce(sum(coalesce(p.studySeconds, 0)), 0) from LessonProgress p
                 where p.enrollment = e)
        from CourseEnrollment e
          join e.user u
          join e.course c
        where e.isActive = true
        order by e.createdAt desc
    """)
    List<Object[]> findLearningHoursRows();
}
