
package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import java.util.Optional;

public interface ExamResultPublicationRepository extends BaseCrudRepository<ExamResultPublication, Long> {
    Optional<ExamResultPublication> findByExam_Id(Long examId);
    boolean existsByExam_Id(Long examId);
}
