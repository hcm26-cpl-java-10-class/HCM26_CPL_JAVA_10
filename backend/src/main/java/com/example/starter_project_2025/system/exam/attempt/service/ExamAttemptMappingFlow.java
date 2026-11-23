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
class ExamAttemptMappingFlow {

    private final ExamAttemptService s;

    ExamAttemptMappingFlow(ExamAttemptService s) {
        this.s = s;
    }

    ExamAttemptDTO toResponse(ExamAttempt attempt) {
        ExamAttemptDTO response = new ExamAttemptDTO();
        response.setId(attempt.getId());
        response.setExamId(attempt.getExam().getId());
        response.setAttemptNumber(attempt.getAttemptNumber());
        response.setTitle(attempt.getExam().getTitle());
        response.setDurationMinutes(attempt.getDurationMinutes());
        response.setTotalPoints(attempt.getTotalPoints());
        response.setMaxScore(ExamScoring.effectiveMax(attempt.getMaxScore()));
        response.setPassScore(attempt.getPassScore());

        // Result Visibility controls automatic availability; publication can override it.
        boolean resultPublished = s.resultAccessService.isResultPublished(attempt.getExam());
        response.setResultPublished(resultPublished);

        if (resultPublished) {
            response.setObjectiveScore(attempt.getObjectiveScore());
            response.setFinalScore(attempt.getFinalScore());
            response.setPassed(ExamScoring.passed(attempt));
            if (attempt.getStatus() != ExamAttemptStatus.IN_PROGRESS
                    && attempt.getStatus() != ExamAttemptStatus.NOT_STARTED) {
                response.setProvisionalScore(attempt.getFinalScore() != null
                        ? attempt.getFinalScore()
                        : ExamScoring.applyPenalty(attempt.getObjectiveScore(), attempt.getLatePenaltyPercentApplied()));
            }
        }
        response.setStatus(attempt.getStatus());
        response.setRevisionNote(attempt.getRevisionNote());
        response.setRevisionDeadline(attempt.getRevisionDeadline());
        response.setStartedAt(attempt.getStartedAt());
        response.setOfficialDeadlineAt(attempt.getOfficialDeadlineAt());
        response.setDeadlineAt(attempt.getDeadlineAt() != null
                ? attempt.getDeadlineAt()
                : attempt.getStartedAt().plus(Duration.ofMinutes(attempt.getDurationMinutes())));
        response.setSubmittedAt(attempt.getSubmittedAt());
        response.setLate(attempt.getSubmittedAt() != null && attempt.getOfficialDeadlineAt() != null
                && attempt.getSubmittedAt().isAfter(attempt.getOfficialDeadlineAt()));
        response.setLatePenaltyPercentApplied(attempt.getLatePenaltyPercentApplied());
        List<ExamAttempt> attempts = s.attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(
                attempt.getExam().getId(), attempt.getStudent().getId());
        int attemptsUsed = Math.max(attempt.getAttemptNumber(), attempts.size());
        response.setAttemptsUsed(attemptsUsed);
        response.setAttemptsRemaining(Math.max(0, s.maxAttempts(attempt.getExam()) - attemptsUsed));
        // NEW (anti-cheat)
        Exam ex = attempt.getExam();
        ExamAttemptDTO.Integrity integrity = new ExamAttemptDTO.Integrity();
        integrity.setEnabled(Boolean.TRUE.equals(ex.getAntiCheatEnabled()));
        integrity.setDetectTabSwitch(integrity.isEnabled() && Boolean.TRUE.equals(ex.getDetectTabSwitch()));
        integrity.setBlockCopyPaste(integrity.isEnabled() && Boolean.TRUE.equals(ex.getBlockCopyPaste()));
        integrity.setRequireFullscreen(integrity.isEnabled() && Boolean.TRUE.equals(ex.getRequireFullscreen()));
        integrity.setSingleSession(integrity.isEnabled() && Boolean.TRUE.equals(ex.getSingleSession()));
        integrity.setCameraProctoring(integrity.isEnabled() && Boolean.TRUE.equals(ex.getCameraProctoring()));
        integrity.setNotifyOnViolation(integrity.isEnabled() && Boolean.TRUE.equals(ex.getNotifyOnViolation()));
        integrity.setHeadTurnAngleDeg(ex.headTurnAngleOrDefault());
        integrity.setHeadTurnSeconds(ex.headTurnSecondsOrDefault());
        integrity.setEntryPhotoDone(!integrity.isCameraProctoring() || attempt.getId() == null
                || s.proctorImageRepository.existsByAttemptIdAndEventIdIsNull(attempt.getId()));
        response.setIntegrity(integrity);
        // Chua chup anh vao thi thi chua duoc xem de (server tu giu lai noi dung cau hoi).
        boolean hideQuestions = attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS
                && integrity.isCameraProctoring() && !integrity.isEntryPhotoDone();
        response.setQuestions(hideQuestions ? List.of() : attempt.getQuestions().stream()
                .map(s.questionTakerMapper::toTakerResponse)
                .toList());
        response.setAnswers(attempt.getAnswers().stream()
                .sorted(Comparator.comparing(answer -> answer.getQuestion().getDisplayOrder()))
                .map(this::toAnswerResponse)
                .toList());
        return response;
    }

    private ExamAttemptDTO.AnswerDTO toAnswerResponse(ExamAttemptAnswer answer) {
        ExamAttemptDTO.AnswerDTO response = new ExamAttemptDTO.AnswerDTO();
        response.setQuestionId(answer.getQuestion().getSourceQuestionId());
        response.setSelectedOptionIds(answer.getSelectedOptions().stream()
                .map(ExamAttemptOption::getSourceOptionId)
                .sorted()
                .toList());
        response.setTextAnswer(answer.getTextAnswer());
        response.setSaved(answer.isSaved());
        return response;
    }

    ExamAttemptSummaryDTO toSummary(ExamAttempt attempt) {
        ExamAttemptSummaryDTO response = new ExamAttemptSummaryDTO();
        response.setId(attempt.getId());
        response.setExamId(attempt.getExam().getId());
        response.setAttemptNumber(attempt.getAttemptNumber());
        response.setStatus(attempt.getStatus());
        response.setRevisionNote(attempt.getRevisionNote());
        response.setRevisionDeadline(attempt.getRevisionDeadline());
        response.setTotalPoints(attempt.getTotalPoints());
        response.setMaxScore(ExamScoring.effectiveMax(attempt.getMaxScore()));
        response.setPassScore(ExamScoring.effectivePassScore(attempt));

        // Result visibility and the explicit publication state control score availability.
        boolean resultPublished = s.resultAccessService.isResultPublished(attempt.getExam());
        response.setResultPublished(resultPublished);
        if (resultPublished) {
            response.setObjectiveScore(attempt.getObjectiveScore());
            response.setFinalScore(attempt.getFinalScore());
            response.setPassed(ExamScoring.passed(attempt));
        }

        response.setStartedAt(attempt.getStartedAt());
        response.setDeadlineAt(s.deadlineOf(attempt));
        response.setSubmittedAt(attempt.getSubmittedAt());
        List<ExamAttempt> attempts = attempt.getStudent() == null
                ? List.of(attempt)
                : s.attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(
                attempt.getExam().getId(), attempt.getStudent().getId());
        int attemptsUsed = Math.max(attempt.getAttemptNumber(), attempts.size());
        response.setAttemptsUsed(attemptsUsed);
        response.setAttemptsRemaining(Math.max(0, s.maxAttempts(attempt.getExam()) - attemptsUsed));
        return response;
    }
}
