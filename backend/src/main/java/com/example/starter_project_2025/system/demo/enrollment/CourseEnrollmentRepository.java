package com.example.starter_project_2025.system.demo.enrollment;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseEnrollmentRepository
        extends BaseCrudRepository<CourseEnrollment, Long> {

    boolean existsByUser_IdAndCourse_Id(Long userId, Long courseId);

    Optional<CourseEnrollment> findByUser_IdAndCourse_Id(Long userId, Long courseId);

    List<CourseEnrollment> findAllByUser_IdOrderByCreatedAtDesc(
            Long userId
    );

    List<CourseEnrollment> findAllByCourse_Id(Long courseId);

    Optional<CourseEnrollment> findByIdAndUser_Id(
            Long enrollmentId,
            Long userId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from CourseEnrollment e where e.id = :enrollmentId and e.user.id = :userId")
    Optional<CourseEnrollment> findOwnedByIdForUpdate(
            @Param("enrollmentId") Long enrollmentId,
            @Param("userId") Long userId
    );

    @Query("select count(distinct e.course.id) from CourseEnrollment e "
            + "join e.user.roles role join e.user.departments department "
            + "where department.id = :departmentId "
            + "and e.user.isActive = true and role.name = 'STUDENT'")
    long countDistinctCoursesByDepartmentId(
            @Param("departmentId") Long departmentId
    );

    @Query("select count(distinct e.user.id) from CourseEnrollment e "
            + "join e.user.roles role join e.user.departments department "
            + "where department.id = :departmentId "
            + "and e.user.isActive = true and role.name = 'STUDENT' "
            + "and e.course.id = :courseId")
    long countEnrolledStudentsByDepartmentAndCourse(
            @Param("departmentId") Long departmentId,
            @Param("courseId") Long courseId
    );

    @Query("select department.id, count(distinct e.user.id) from CourseEnrollment e "
            + "join e.user.roles role join e.user.departments department "
            + "where e.user.isActive = true and role.name = 'STUDENT' "
            + "and e.course.id = :courseId group by department.id")
    List<Object[]> countEnrolledStudentsPerDepartmentForCourse(
            @Param("courseId") Long courseId
    );

    @Query("select distinct e.user.id from CourseEnrollment e "
            + "join e.user.roles role join e.user.departments department "
            + "where department.id = :departmentId "
            + "and e.user.isActive = true and role.name = 'STUDENT' "
            + "and e.course.id = :courseId")
    List<Long> findEnrolledUserIdsByDepartmentAndCourse(
            @Param("departmentId") Long departmentId,
            @Param("courseId") Long courseId
    );
}
