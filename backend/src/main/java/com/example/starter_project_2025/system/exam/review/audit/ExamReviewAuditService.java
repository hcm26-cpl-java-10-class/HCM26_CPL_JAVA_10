package com.example.starter_project_2025.system.exam.review.audit;

import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ghi nhật ký thao tác của workflow tự đánh giá / đánh giá chéo.
 *
 * <p>Dùng {@code REQUIRES_NEW} để audit không bị rollback khi transaction nghiệp vụ thất bại.
 */
@Service
@RequiredArgsConstructor
public class ExamReviewAuditService {

    private final ExamReviewAuditRepository auditRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Long examId,
                       Long assignmentId,
                       Long attemptId,
                       ExamReviewAuditAction action,
                       Long actorId,
                       Object beforeState,
                       Object afterState) {
        auditRepository.save(ExamReviewAuditLog.builder()
                .examId(examId)
                .assignmentId(assignmentId)
                .attemptId(attemptId)
                .action(action)
                .actorId(actorId)
                .beforeState(toJson(beforeState))
                .afterState(toJson(afterState))
                .correlationId(CorrelationIdFilter.currentId())
                .build());
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return null;
        }
    }
}
