package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ExamResultEmailLogRepository
        extends BaseCrudRepository<ExamResultEmailLog, Long> {

    Optional<ExamResultEmailLog>
    findByExam_IdAndStudentIdAndPublicationVersion(
            Long examId,
            Long studentId,
            LocalDateTime publicationVersion
    );

    List<ExamResultEmailLog>
    findByExam_IdAndPublicationVersion(
            Long examId,
            LocalDateTime publicationVersion
    );

    boolean existsByExam_IdAndStudentIdAndPublicationVersionAndStatus(
            Long examId,
            Long studentId,
            LocalDateTime publicationVersion,
            ScoreEmailDeliveryStatus status
    );
}
