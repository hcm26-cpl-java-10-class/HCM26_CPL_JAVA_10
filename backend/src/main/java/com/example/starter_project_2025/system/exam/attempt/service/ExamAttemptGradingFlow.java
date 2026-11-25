package com.example.starter_project_2025.system.exam.attempt.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService;
import com.example.starter_project_2025.system.question.core.dto.CodeSpecDTO;
import com.example.starter_project_2025.system.question.core.service.CodeSpecSupport;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.attempt.dto.ExamAttemptDTO;
import com.example.starter_project_2025.system.exam.attempt.dto.ExamAttemptReviewDTO;
import com.example.starter_project_2025.system.exam.attempt.dto.ExamAttemptSummaryDTO;
import com.example.starter_project_2025.system.exam.attempt.dto.SaveExamAnswerRequest;
import com.example.starter_project_2025.system.question.core.mapper.QuestionTakerMapper;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptOption;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.code.CodingScoring;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.core.domain.LatePolicy;
import com.example.starter_project_2025.system.exam.courselink.service.ExamProgressLockService;
import com.example.starter_project_2025.system.exam.grading.service.ExamScoring;
import com.example.starter_project_2025.system.exam.integrity.domain.ExamProctorImageRepository;
import com.example.starter_project_2025.system.exam.invitation.domain.Invitation;
import com.example.starter_project_2025.system.exam.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.exam.invitation.domain.InvitationStatus;
import com.example.starter_project_2025.system.exam.pool.domain.ExamPoolQuestion;
import com.example.starter_project_2025.system.exam.pool.domain.ExamPoolQuestionOption;
import com.example.starter_project_2025.system.exam.pool.domain.ExamQuestionPoolVersion;
import com.example.starter_project_2025.system.exam.pool.domain.ExamQuestionPoolVersionRepository;
import com.example.starter_project_2025.system.exam.pool.service.ExamPoolAttemptSnapshotService;
import com.example.starter_project_2025.system.exam.pool.service.ExamPoolRandomSelectionService;
import com.example.starter_project_2025.system.exam.result.service.ExamResultAccessService;
import com.example.starter_project_2025.system.question.core.domain.EssayGradingCriterion;
import com.example.starter_project_2025.system.question.core.domain.Question;
import com.example.starter_project_2025.system.question.core.domain.QuestionOption;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;

/** Tach tu ExamAttemptService: giu nguyen hanh vi, chi chuyen cac phuong thuc cung trach nhiem ra file rieng. */
class ExamAttemptGradingFlow {

    private final ExamAttemptService s;

    ExamAttemptGradingFlow(ExamAttemptService s) {
        this.s = s;
    }

    void gradeAndSubmit(ExamAttempt attempt, Instant submittedAt, boolean expired) {
        BigDecimal correctWeight = BigDecimal.ZERO;
        boolean hasEssay = false;
        boolean codeNeedsReview = false;
        BigDecimal maxScore = ExamScoring.effectiveMax(attempt.getMaxScore());

        Map<Long, Set<Long>> selectedByQuestion = new HashMap<>();
        for (ExamAttemptAnswer answer : attempt.getAnswers()) {
            selectedByQuestion.put(
                    answer.getQuestion().getSourceQuestionId(),
                    answer.getSelectedOptions().stream()
                            .map(ExamAttemptOption::getSourceOptionId)
                            .collect(Collectors.toSet()));
        }

        for (ExamAttemptQuestion question : new ArrayList<>(attempt.getQuestions())) {
            if (question.getType() == QuestionType.ESSAY) {
                hasEssay = true;
                continue;
            }
            if (question.getType() == QuestionType.CODING) {
                CodingOutcome outcome = gradeCodingQuestion(attempt, question, maxScore);
                correctWeight = correctWeight.add(outcome.weight());
                codeNeedsReview |= outcome.needsReview();
                continue;
            }
            Set<Long> correctIds = question.getOptions().stream()
                    .filter(ExamAttemptOption::isCorrect)
                    .map(ExamAttemptOption::getSourceOptionId)
                    .collect(Collectors.toSet());
            if (correctIds.equals(selectedByQuestion.getOrDefault(question.getSourceQuestionId(), Set.of()))) {
                correctWeight = correctWeight.add(BigDecimal.valueOf(question.getPoints()));
            }
        }

        analyzeAiContent(attempt);

        BigDecimal objectiveScore = ExamScoring.share(maxScore, correctWeight, attempt.getTotalPoints());
        attempt.setObjectiveScore(objectiveScore);
        Integer penalty = attempt.isLateGraceEligible()
                && attempt.getOfficialDeadlineAt() != null
                && submittedAt.isAfter(attempt.getOfficialDeadlineAt())
                && attempt.getLatePolicy() == LatePolicy.ALLOWED_WITH_PENALTY
                ? attempt.getLatePenaltyPercent()
                : null;
        attempt.setLatePenaltyPercentApplied(penalty);
        boolean needsManual = hasEssay || codeNeedsReview;
        attempt.setFinalScore(needsManual ? null : ExamScoring.applyPenalty(objectiveScore, penalty));
        attempt.setStatus(ExamAttemptLifecycle.finalStatus(needsManual, expired));
        attempt.setSubmittedAt(submittedAt);

        markInvitationsCompleted(attempt);
    }

    /** Estimate the AI-written percentage for every essay / coding answer at submit time. */
    private void analyzeAiContent(ExamAttempt attempt) {
        for (ExamAttemptAnswer answer : attempt.getAnswers()) {
            QuestionType type = answer.getQuestion().getType();
            if (type != QuestionType.ESSAY && type != QuestionType.CODING) continue;
            var r = com.example.starter_project_2025.system.exam.integrity.ai.AiContentDetector
                    .analyze(answer.getTextAnswer(), type == QuestionType.CODING);
            answer.setAiPercent(r == null ? null : r.percent());
            answer.setAiSignals(r == null ? null : String.join(" | ", r.signals()));
        }
    }

    /**
     * Khi sinh viên nộp bài (hoặc hết giờ bị chấm), lời mời tương ứng chuyển sang COMPLETED
     * để không còn ai gửi nhắc nhở nữa và giữ đúng vòng đời lời mời.
     */
    private void markInvitationsCompleted(ExamAttempt attempt) {
        User student = attempt.getStudent();
        if (student == null || student.getId() == null) {
            return;
        }
        List<Invitation> invitations = s.invitationRepository
                .findOpenByExamIdAndStudentId(attempt.getExam().getId(), student.getId());
        if (invitations.isEmpty()) {
            return;
        }
        for (Invitation invitation : invitations) {
            invitation.setStatus(InvitationStatus.COMPLETED);
            s.invitationRepository.save(invitation);
        }
    }

    private record CodingOutcome(BigDecimal weight, boolean needsReview) {
    }

    /** Cau lap trinh: tinh diem o nen, o day chi danh dau cho cham (hoac 0 diem neu khong nop code). */
    private CodingOutcome gradeCodingQuestion(ExamAttempt attempt, ExamAttemptQuestion question, BigDecimal maxScore) {
        ExamAttemptAnswer answer = s.findOrCreateAnswer(attempt, question);
        CodeSpecDTO spec = CodeSpecSupport.fromJson(question.getCodeSpec());
        if (spec == null || spec.getTests() == null || spec.getTests().isEmpty()) {
            answer.setScore(BigDecimal.ZERO);
            answer.setFeedback("Câu hỏi chưa có test case để chấm");
            return new CodingOutcome(BigDecimal.ZERO, false);
        }

        String code = answer.getTextAnswer();
        if (code == null || code.isBlank()) {
            // Khong nop code: 0 diem ngay, khong can goi may cham.
            answer.setScore(BigDecimal.ZERO.setScale(ExamScoring.STORE_SCALE));
            answer.setFeedback("Đạt 0/" + spec.getTests().size() + " test (chưa nộp code)");
            answer.setCodeResult(CodingScoring.noCodeJson(spec.getTests().size()));
            return new CodingOutcome(BigDecimal.ZERO, false);
        }

        // Cham o nen (CodingGradingJob): nop bai xong ngay, diem cau coding se co sau it phut.
        answer.setScore(null);
        answer.setGradeAttempts(0);
        answer.setNextGradeAt(null);
        answer.setCodeResult(null);
        answer.setFeedback("Đang chấm tự động, điểm sẽ có sau ít phút");
        return new CodingOutcome(BigDecimal.ZERO, true);
    }
}
