package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.code.CodeJudgeService;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService.GradeResult;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.CodeSpecDTO;
import com.example.starter_project_2025.system.question.service.CodeSpecSupport;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

/**
 * Cham cau lap trinh o nen: luc nop bai chi danh dau "dang cham", job nay goi Judge0 va ghi diem.
 * Loi may cham duoc thu lai {@link #MAX_AUTO_ATTEMPTS} lan, moi lan cach {@link #RETRY_DELAY_SECONDS} giay,
 * sau do de giao vien cham lai thu cong.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CodingGradingService {

    public static final int MAX_AUTO_ATTEMPTS = 5;
    public static final long RETRY_DELAY_SECONDS = 60;

    private static final String DUE_QUERY = """
            select a.id from ExamAttemptAnswer a
            where a.question.type = :coding
              and a.score is null
              and a.gradeAttempts < :max
              and a.attempt.firstScore is null
              and a.attempt.status in :statuses
              and (a.nextGradeAt is null or a.nextGradeAt <= :now)
            order by a.id
            """;

    private final ExamAttemptRepository attemptRepository;
    private final CodeJudgeService judgeService;
    private final PlatformTransactionManager transactionManager;

    @PersistenceContext
    private EntityManager entityManager;

    private record Work(Long answerId, Long attemptId, CodeSpecDTO spec, String code) {
    }

    /** Cham toi da {@code batchSize} cau dang cho; tra ve so cau da xu ly xong (co diem hoac da ghi loi). */
    public int gradeDue(int batchSize) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        List<Long> ids = tx.execute(status -> entityManager.createQuery(DUE_QUERY, Long.class)
                .setParameter("coding", QuestionType.CODING)
                .setParameter("max", MAX_AUTO_ATTEMPTS)
                .setParameter("statuses", List.of(ExamAttemptStatus.PENDING_REVIEW,
                        ExamAttemptStatus.EXPIRED, ExamAttemptStatus.SUBMITTED))
                .setParameter("now", Instant.now())
                .setMaxResults(batchSize)
                .getResultList());
        int handled = 0;
        if (ids == null) {
            return 0;
        }
        for (Long id : ids) {
            try {
                if (gradeOne(tx, id)) {
                    handled++;
                }
            } catch (RuntimeException e) {
                log.warn("Khong cham duoc cau coding (answer {})", id, e);
            }
        }
        return handled;
    }

    private boolean gradeOne(TransactionTemplate tx, Long answerId) {
        Work work = tx.execute(status -> {
            ExamAttemptAnswer answer = entityManager.find(ExamAttemptAnswer.class, answerId);
            if (answer == null || answer.getScore() != null) {
                return null;
            }
            CodeSpecDTO spec = CodeSpecSupport.fromJson(answer.getQuestion().getCodeSpec());
            if (spec == null || spec.getTests() == null || spec.getTests().isEmpty()) {
                // Khong co test de cham: dung de job lap lai mai.
                answer.setGradeAttempts(MAX_AUTO_ATTEMPTS);
                answer.setFeedback("Câu hỏi chưa có test case để chấm");
                return null;
            }
            return new Work(answerId, answer.getAttempt().getId(), spec, answer.getTextAnswer());
        });
        if (work == null) {
            return false;
        }

        // Goi Judge0 ngoai transaction de khong giu ket noi DB / khoa bai lam khi cho may cham.
        GradeResult result = judgeService.grade(work.spec(), work.code());

        tx.executeWithoutResult(status -> apply(work, result));
        return true;
    }

    private void apply(Work work, GradeResult result) {
        ExamAttempt attempt = attemptRepository.lockById(work.attemptId()).orElse(null);
        ExamAttemptAnswer answer = entityManager.find(ExamAttemptAnswer.class, work.answerId());
        if (attempt == null || answer == null || answer.getScore() != null || attempt.getFirstScore() != null) {
            return; // giao vien da cham tay / sua diem trong luc cho
        }

        if (result.infraError()) {
            int tried = answer.getGradeAttempts() + 1;
            answer.setGradeAttempts(tried);
            if (tried >= MAX_AUTO_ATTEMPTS) {
                answer.setNextGradeAt(null);
                answer.setFeedback("Máy chấm code không phản hồi sau " + MAX_AUTO_ATTEMPTS
                        + " lần thử, cần giáo viên chấm lại");
            } else {
                answer.setNextGradeAt(Instant.now().plusSeconds(RETRY_DELAY_SECONDS));
                answer.setFeedback("Máy chấm code chưa phản hồi, hệ thống sẽ tự thử lại (lần "
                        + tried + "/" + MAX_AUTO_ATTEMPTS + ")");
            }
            return;
        }

        BigDecimal newScore = CodingScoring.score(attempt, answer.getQuestion(), result);
        answer.setScore(newScore);
        answer.setFeedback(CodingScoring.feedback(result));
        answer.setCodeResult(CodingScoring.statusesJson(result));
        answer.setNextGradeAt(null);

        BigDecimal objective = attempt.getObjectiveScore() == null ? BigDecimal.ZERO : attempt.getObjectiveScore();
        attempt.setObjectiveScore(objective.add(newScore).setScale(ExamScoring.STORE_SCALE, RoundingMode.HALF_UP));
        CodingScoring.recomputeFinalScore(attempt, ExamScoring.effectiveMax(attempt.getMaxScore()));
        attemptRepository.save(attempt);
    }
}
