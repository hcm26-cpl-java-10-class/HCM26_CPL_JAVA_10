package com.example.starter_project_2025.system.demo.enrollment;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseEnrollmentRepository
        extends BaseCrudRepository<CourseEnrollment, Long> {

    boolean existsByUser_IdAndCourse_Id(Long userId, Long courseId);

    List<CourseEnrollment> findAllByUser_IdOrderByCreatedAtDesc(
            Long userId
    );

    Optional<CourseEnrollment> findByIdAndUser_Id(
            Long enrollmentId,
            Long userId
    );

    @Query("select count(distinct e.course.id) from CourseEnrollment e "
            + "join e.user.roles role where e.user.department.id = :departmentId "
            + "and e.user.isActive = true and role.name = 'STUDENT'")
    long countDistinctCoursesByDepartmentId(
            @Param("departmentId") Long departmentId
    );

    @Query("select count(distinct e.user.id) from CourseEnrollment e "
            + "join e.user.roles role where e.user.department.id = :departmentId "
            + "and e.user.isActive = true and role.name = 'STUDENT' "
            + "and e.course.id = :courseId")
    long countEnrolledStudentsByDepartmentAndCourse(
            @Param("departmentId") Long departmentId,
            @Param("courseId") Long courseId
    );

    @Query("select distinct e.user.id from CourseEnrollment e "
            + "join e.user.roles role where e.user.department.id = :departmentId "
            + "and e.user.isActive = true and role.name = 'STUDENT' "
            + "and e.course.id = :courseId")
    List<Long> findEnrolledUserIdsByDepartmentAndCourse(
            @Param("departmentId") Long departmentId,
            @Param("courseId") Long courseId
    );
}