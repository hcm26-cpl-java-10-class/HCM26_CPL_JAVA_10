package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

@Repository
public interface StudentRepository extends BaseCrudRepository<Student, Long> {
    boolean existsByStudentCode(String studentCode);
    boolean existsByEmail(String email);

    @Query("""
            SELECT DISTINCT tc.code
            FROM ClassEnrollment enrollment
            JOIN enrollment.trainingClass tc
            WHERE enrollment.isActive = true
              AND enrollment.status = com.example.starter_project_2025.system.training.ClassEnrollment.Status.ACTIVE
              AND (
                    (:studentCode IS NOT NULL AND enrollment.studentId IS NOT NULL
                        AND UPPER(enrollment.studentId) = UPPER(:studentCode))
                    OR
                    (:email IS NOT NULL AND enrollment.personalEmail IS NOT NULL
                        AND LOWER(enrollment.personalEmail) = LOWER(:email))
              )
            ORDER BY tc.code
            """)
    List<String> findActiveTrainingClassCodes(
            @Param("studentCode") String studentCode,
            @Param("email") String email
    );
}
