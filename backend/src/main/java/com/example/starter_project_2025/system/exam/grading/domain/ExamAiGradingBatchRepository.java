package com.example.starter_project_2025.system.exam.grading.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ExamAiGradingBatchRepository extends BaseCrudRepository<ExamAiGradingBatch, Long> {

    Optional<ExamAiGradingBatch> findFirstByExamIdAndStatusInOrderByCreatedAtDesc(
            Long examId,
            Collection<AiGradingBatchStatus> statuses
    );

    Optional<ExamAiGradingBatch> findFirstByTriggeredByUserIdAndExamIdIsNullAndStatusInOrderByCreatedAtDesc(
            Long triggeredByUserId,
            Collection<AiGradingBatchStatus> statuses
    );

    Optional<ExamAiGradingBatch> findFirstByExamIdOrderByCreatedAtDesc(Long examId);

    Optional<ExamAiGradingBatch> findFirstByTriggeredByUserIdOrderByCreatedAtDesc(Long triggeredByUserId);

    @Query("select b from ExamAiGradingBatch b where b.status in :statuses order by b.id asc")
    List<ExamAiGradingBatch> findByStatusIn(@Param("statuses") Collection<AiGradingBatchStatus> statuses);
}
