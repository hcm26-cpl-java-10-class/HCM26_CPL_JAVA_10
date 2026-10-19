package com.example.starter_project_2025.system.class_setup;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EnrollmentRepository extends BaseCrudRepository<Enrollment, Long> {

    List<Enrollment> findByClassId(Long classId);

    // Provided for Tan: Student schedule by enrollment
    List<Enrollment> findByStudentId(Long studentId);

    Optional<Enrollment> findByClassIdAndStudentId(Long classId, Long studentId);
}
