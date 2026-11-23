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
class ExamAttemptQuestionFlow {

    private final ExamAttemptService s;

    ExamAttemptQuestionFlow(ExamAttemptService s) {
        this.s = s;
    }

    void snapshotQuestions(
            ExamAttempt attempt,
            Exam exam,
            List<Question> source,
            boolean shuffleOrder
    ) {
        List<Question> ordered = new ArrayList<>(source);
        if (shuffleOrder) {
            Collections.shuffle(ordered);
        }
        int questionOrder = 0;
        for (Question q : ordered) {
            ExamAttemptQuestion snap = new ExamAttemptQuestion();
            snap.setAttempt(attempt);
            snap.setSourceQuestionId(q.getId());
            snap.setContent(q.getContent());
            snap.setImageUrl(q.getImageUrl());
            snap.setType(q.getType());
            snap.setPoints(q.getPoints());
            snap.setCodeSpec(q.getCodeSpec());
            snap.setDisplayOrder(questionOrder++);
            q.getGradingCriteria().forEach(sourceCriterion -> {
                EssayGradingCriterion criterion = new EssayGradingCriterion();
                criterion.setName(sourceCriterion.getName());
                criterion.setDescription(sourceCriterion.getDescription());
                criterion.setWeightPercentage(sourceCriterion.getWeightPercentage());
                snap.getGradingCriteria().add(criterion);
            });

            List<QuestionOption> options = new ArrayList<>(q.getOptions());
            options.sort(Comparator.comparing(QuestionOption::getId));
            if (Boolean.TRUE.equals(exam.getShuffleOptions()) && q.getType() != QuestionType.ESSAY) {
                Collections.shuffle(options);
            }
            int optionOrder = 0;
            for (QuestionOption o : options) {
                ExamAttemptOption snapOption = new ExamAttemptOption();
                snapOption.setQuestion(snap);
                snapOption.setSourceOptionId(o.getId());
                snapOption.setContent(o.getContent());
                snapOption.setImageUrl(o.getImageUrl());
                snapOption.setCorrect(o.isCorrect());
                snapOption.setDisplayOrder(optionOrder++);
                snap.getOptions().add(snapOption);
            }
            attempt.getQuestions().add(snap);
        }
    }

    List<Question> activeQuestions(Exam exam) {
        return exam.getQuestions().stream()
                .filter(question -> Boolean.TRUE.equals(question.getIsActive()))
                .sorted(Comparator.comparing(Question::getId))
                .toList();
    }

    List<ExamPoolQuestion> questionsFromPool(
            ExamQuestionPoolVersion version
    ) {
        List<ExamPoolQuestion> poolEntries = version.getQuestions();

        if (poolEntries == null || poolEntries.isEmpty()) {
            throw new BadRequestException("Question Pool chưa có câu hỏi");
        }

        // Chỉ kiểm tra dữ liệu snapshot đã lưu trong Pool Version.
        List<ExamPoolQuestion> validPoolEntries = poolEntries.stream()
                .filter(this::isPoolSnapshotStructurallyValid)
                .toList();

        if (validPoolEntries.isEmpty()) {
            throw new BadRequestException(
                    "Question Pool không có câu hỏi hợp lệ"
            );
        }

        // Random không trùng câu trong cùng một Attempt.
        return s.randomSelectionService.selectQuestions(
                version,
                validPoolEntries
        );
    }

    private boolean isPoolSnapshotStructurallyValid(
            ExamPoolQuestion question
    ) {
        if (question == null
                || question.getQuestionId() == null
                || question.getContent() == null
                || question.getContent().isBlank()
                || question.getType() == null
                || question.getPoints() <= 0) {
            return false;
        }

        List<ExamPoolQuestionOption> options =
                question.getOptions() == null
                        ? List.of()
                        : question.getOptions();

        if (question.getType() == QuestionType.ESSAY) {
            return options.isEmpty();
        }

        if (question.getType() == QuestionType.CODING) {
            return options.isEmpty()
                    && question.getCodeSpec() != null
                    && !question.getCodeSpec().isBlank();
        }

        if (options.size() < 2 || options.size() > 6) {
            return false;
        }

        boolean hasEmptyOption = options.stream()
                .anyMatch(option -> option.getContent() == null
                        || option.getContent().isBlank());

        boolean hasDuplicateOption = options.stream()
                .map(option -> option.getContent().trim())
                .map(value -> value.toLowerCase(Locale.ROOT))
                .distinct()
                .count() != options.size();

        boolean hasCorrectAnswer = options.stream()
                .anyMatch(ExamPoolQuestionOption::isCorrect);

        return !hasEmptyOption
                && !hasDuplicateOption
                && hasCorrectAnswer;
    }
}
