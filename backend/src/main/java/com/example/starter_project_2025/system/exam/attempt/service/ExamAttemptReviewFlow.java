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
class ExamAttemptReviewFlow {

    private final ExamAttemptService s;

    ExamAttemptReviewFlow(ExamAttemptService s) {
        this.s = s;
    }

    public ExamAttemptReviewDTO reviewAttempt(Long attemptId, Long studentId) {
        ExamAttempt attempt = s.attemptRepository.findByIdAndStudent_Id(attemptId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        Exam exam = attempt.getExam();
        int attemptsUsed = Math.max(
                attempt.getAttemptNumber(),
                s.attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(exam.getId(), studentId).size());
        int attemptsRemaining = Math.max(0, s.maxAttempts(exam) - attemptsUsed);

        // Diem + dap an dung/sai chi lo ra khi giao vien da cong bo ket qua.
        boolean revealAnswers = s.resultAccessService.canStudentViewScore(exam)
                && s.resultAccessService.canStudentViewAnswers(exam, attempt.getStatus(), attemptsRemaining);
        // Bai lam cua chinh minh: xem duoc ngay sau khi nop voi de thi "Manually released".
        boolean canViewOwn = s.resultAccessService.canStudentViewOwnSubmission(exam, attempt.getStatus());

        if (!revealAnswers && !canViewOwn) {
            throw new AccessDeniedException("Chưa thể xem bài làm của bài thi này");
        }

        return toReviewDTO(attempt, revealAnswers);
    }

    /**
     * Giao vien / admin xem bai lam cua sinh vien de kiem tra khi xu ly khieng nai.
     * Luon hien thi dap an dung/sai vi giao vien can dung de cham.
     */
    public ExamAttemptReviewDTO reviewAttemptForTeacher(Long attemptId) {
        ExamAttempt attempt = findAttemptForReview(attemptId);
        return toReviewDTO(attempt, true);
    }

    public ExamAttempt findAttemptForReview(Long attemptId) {
        return s.attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
    }

    private ExamAttemptReviewDTO toReviewDTO(ExamAttempt attempt, boolean revealAnswers) {
        Exam exam = attempt.getExam();
        Map<Long, ExamAttemptAnswer> answerByQuestion = new HashMap<>();
        for (ExamAttemptAnswer answer : attempt.getAnswers()) {
            answerByQuestion.put(answer.getQuestion().getId(), answer);
        }

        ExamAttemptReviewDTO response = new ExamAttemptReviewDTO();
        response.setAttemptId(attempt.getId());
        response.setExamId(exam.getId());
        response.setTitle(exam.getTitle());
        response.setAttemptNumber(attempt.getAttemptNumber());
        response.setStatus(attempt.getStatus());
        response.setRevisionNote(attempt.getRevisionNote());
        response.setRevisionDeadline(attempt.getRevisionDeadline());
        response.setTotalPoints(attempt.getTotalPoints());
        response.setMaxScore(ExamScoring.effectiveMax(attempt.getMaxScore()));
        // Chua cong bo ket qua: an diem va dap an dung/sai, chi con cau da lam.
        response.setObjectiveScore(revealAnswers ? attempt.getObjectiveScore() : null);
        response.setFinalScore(revealAnswers ? attempt.getFinalScore() : null);
        response.setPassScore(ExamScoring.effectivePassScore(attempt));
        response.setPassed(revealAnswers ? ExamScoring.passed(attempt) : null);
        response.setSubmittedAt(attempt.getSubmittedAt());
        response.setRevealAnswers(revealAnswers);
        response.setQuestions(attempt.getQuestions().stream()
                .sorted(Comparator.comparingInt(ExamAttemptQuestion::getDisplayOrder))
                .map(question -> toQuestionReview(
                        question,
                        answerByQuestion.get(question.getId()),
                        response.getMaxScore(),
                        attempt.getTotalPoints(),
                        revealAnswers))
                .toList());
        return response;
    }

    private ExamAttemptReviewDTO.QuestionReviewDTO toQuestionReview(ExamAttemptQuestion question, ExamAttemptAnswer answer, BigDecimal maxScore, int totalWeight, boolean revealAnswers) {
        Set<Long> selectedIds = answer == null
                ? Set.of()
                : answer.getSelectedOptions().stream()
                .map(ExamAttemptOption::getSourceOptionId)
                .collect(Collectors.toSet());

        ExamAttemptReviewDTO.QuestionReviewDTO dto = new ExamAttemptReviewDTO.QuestionReviewDTO();
        dto.setQuestionId(question.getSourceQuestionId());
        dto.setContent(question.getContent());
        dto.setImageUrl(question.getImageUrl());
        dto.setType(question.getType());
        dto.setPoints(question.getPoints());
        dto.setMaxScore(ExamScoring.gradingCap(maxScore, question.getPoints(), totalWeight));

        if (question.getType() == QuestionType.ESSAY || question.getType() == QuestionType.CODING) {
            dto.setOptions(List.of());
            if (answer != null) {
                dto.setTextAnswer(answer.getTextAnswer());
                // Chua cong bo: an diem va nhan xet cua giao vien.
                dto.setScore(revealAnswers ? answer.getScore() : null);
                dto.setFeedback(revealAnswers ? answer.getFeedback() : null);
            }
            return dto;
        }

        Set<Long> correctIds = question.getOptions().stream()
                .filter(ExamAttemptOption::isCorrect)
                .map(ExamAttemptOption::getSourceOptionId)
                .collect(Collectors.toSet());
        // Chua cong bo: khong cho hoc sinh biet cau nao dung/sai.
        dto.setCorrect(revealAnswers ? correctIds.equals(selectedIds) : null);
        dto.setOptions(question.getOptions().stream()
                .sorted(Comparator.comparingInt(ExamAttemptOption::getDisplayOrder))
                .map(option -> {
                    ExamAttemptReviewDTO.OptionReviewDTO o = new ExamAttemptReviewDTO.OptionReviewDTO();
                    o.setId(option.getSourceOptionId());
                    o.setContent(option.getContent());
                    o.setImageUrl(option.getImageUrl());
                    o.setCorrect(revealAnswers && option.isCorrect());
                    o.setSelected(selectedIds.contains(option.getSourceOptionId()));
                    return o;
                })
                .toList());
        return dto;
    }
}
