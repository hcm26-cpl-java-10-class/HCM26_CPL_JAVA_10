package com.example.starter_project_2025.system.demo.enrollment;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
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
}