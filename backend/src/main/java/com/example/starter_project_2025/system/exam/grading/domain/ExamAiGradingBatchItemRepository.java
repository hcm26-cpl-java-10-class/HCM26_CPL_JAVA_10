package com.example.starter_project_2025.system.exam.grading.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ExamAiGradingBatchItemRepository extends BaseCrudRepository<ExamAiGradingBatchItem, Long> {

    List<ExamAiGradingBatchItem> findByBatch_IdOrderByIdAsc(Long batchId);

    List<ExamAiGradingBatchItem> findByBatch_IdAndStatusInOrderByIdAsc(
            Long batchId,
            Collection<AiEssayGradingState> statuses
    );

    boolean existsByAttemptIdAndStatusIn(Long attemptId, Collection<AiEssayGradingState> statuses);

    @Modifying
    @Query("update ExamAiGradingBatchItem i set i.status = :targetStatus where i.status = :fromStatus")
    int resetStuckItems(
            @Param("fromStatus") AiEssayGradingState fromStatus,
            @Param("targetStatus") AiEssayGradingState targetStatus
    );
}
