package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptDTO;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptSummaryDTO;
import com.example.starter_project_2025.system.exam.dto.SaveExamAnswerRequest;
import com.example.starter_project_2025.system.invitation.domain.Invitation;
import com.example.starter_project_2025.system.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.invitation.domain.InvitationStatus;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.QuestionTakerDTO;
import com.example.starter_project_2025.system.question.mapper.QuestionTakerMapper;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ExamAttemptService {

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final InvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final QuestionTakerMapper questionTakerMapper;

    public ExamAttemptDTO startOrResume(Long examId, Long studentId) {
        Exam exam = examRepository.lockForAttemptStart(examId)
            .filter(candidate -> Boolean.TRUE.equals(candidate.getIsActive()))
            .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
        LocalDateTime nowLocal = LocalDateTime.now();
        ensureInvitationAccepted(examId, studentId);

        List<ExamAttempt> attempts = attemptRepository
            .findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(examId, studentId);
        Optional<ExamAttempt> existing = attempts.stream()
            .filter(candidate -> candidate.getStatus() == ExamAttemptStatus.IN_PROGRESS)
            .max(Comparator.comparingInt(ExamAttempt::getAttemptNumber));
        if (existing.isPresent()) {
            ExamAttempt attempt = existing.get();
            submitIfExpired(attempt, Instant.now());
            return toResponse(attempt);
        }

        ensureExamWindowOpen(exam, nowLocal);

        int maxAttempts = exam.getMaxAttempts() == null ? 1 : exam.getMaxAttempts();
        if (attempts.size() >= maxAttempts) {
            throw new BadRequestException("Bạn đã sử dụng hết số lần làm bài");
        }
        List<Question> questions = activeQuestions(exam);
        if (questions.isEmpty()) {
            throw new BadRequestException("Đề thi chưa có câu hỏi đang hoạt động");
        }

        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));
        Instant startedAt = Instant.now();
        ExamAttempt attempt = new ExamAttempt();
        attempt.setExam(exam);
        attempt.setStudent(student);
        attempt.setAttemptNumber(attempts.stream()
            .mapToInt(ExamAttempt::getAttemptNumber)
            .max()
            .orElse(0) + 1);
        attempt.setDurationMinutes(exam.getDurationMinutes());
        attempt.setTotalPoints(questions.stream().mapToInt(Question::getPoints).sum());
        attempt.setStartedAt(startedAt);
        Instant durationDeadline = startedAt.plus(Duration.ofMinutes(exam.getDurationMinutes()));
        Instant examDeadline = exam.getEndTime() == null
            ? null
            : exam.getEndTime().atZone(ZoneId.systemDefault()).toInstant();
        boolean lateGraceEligible = examDeadline != null && !durationDeadline.isBefore(examDeadline);
        Instant officialDeadline = lateGraceEligible ? examDeadline : durationDeadline;
        int graceMinutes = exam.getLatePolicy() == LatePolicy.NOT_ALLOWED || exam.getLateGraceMinutes() == null
                ? 0
                : exam.getLateGraceMinutes();
        attempt.setLateGraceEligible(lateGraceEligible && graceMinutes > 0);
        attempt.setLatePolicy(exam.getLatePolicy());
        attempt.setLatePenaltyPercent(exam.getLatePenaltyPercent());
        attempt.setOfficialDeadlineAt(officialDeadline);
        attempt.setDeadlineAt(officialDeadline.plus(Duration.ofMinutes(attempt.isLateGraceEligible() ? graceMinutes : 0)));
        attempt.setStatus(ExamAttemptStatus.IN_PROGRESS);
        return toResponse(attemptRepository.save(attempt));
    }

    private void ensureExamWindowOpen(Exam exam, LocalDateTime now) {
        if (exam.getStartTime() != null && now.isBefore(exam.getStartTime())) {
            throw new BadRequestException("Kỳ thi chưa đến giờ mở");
        }
        if (exam.getEndTime() != null && !now.isBefore(exam.getEndTime())) {
            throw new BadRequestException("Kỳ thi đã đóng");
        }
    }

    private void ensureInvitationAccepted(Long examId, Long studentId) {
        Invitation invitation = invitationRepository.findByExamIdAndUserId(examId, studentId)
                .filter(candidate -> Boolean.TRUE.equals(candidate.getIsActive()))
                .filter(candidate -> candidate.getStatus() == InvitationStatus.ACCEPTED)
                .orElseThrow(() -> new BadRequestException("Bạn cần chấp nhận lời mời còn hiệu lực trước khi thi"));
    }

    public List<ExamAttemptSummaryDTO> findStudentAttempts(Long studentId) {
        return attemptRepository.findAllByStudent_IdOrderByStartedAtDesc(studentId).stream()
                .map(this::toSummary)
                .toList();
    }

    public ExamAttemptDTO saveAnswers(
            Long attemptId,
            Long studentId,
            List<SaveExamAnswerRequest> requests
    ) {
        ExamAttempt attempt = findLockedAttempt(attemptId, studentId);
        Instant now = Instant.now();
        if (submitIfExpired(attempt, now)) {
            return toResponse(attempt);
        }
        ensureInProgress(attempt);
        applyAnswers(attempt, requests);
        return toResponse(attemptRepository.save(attempt));
    }

    public ExamAttemptDTO submit(
            Long attemptId,
            Long studentId,
            List<SaveExamAnswerRequest> requests
    ) {
        ExamAttempt attempt = findLockedAttempt(attemptId, studentId);
        if (attempt.getStatus() != ExamAttemptStatus.IN_PROGRESS) {
            return toResponse(attempt);
        }

        Instant now = Instant.now();
        if (!isExpired(attempt, now)) {
            applyAnswers(attempt, requests);
        }
        gradeAndSubmit(attempt, now);
        return toResponse(attemptRepository.save(attempt));
    }

    private ExamAttempt findLockedAttempt(Long attemptId, Long studentId) {
        return attemptRepository.lockByIdAndStudentId(attemptId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
    }

    private boolean submitIfExpired(ExamAttempt attempt, Instant now) {
        if (attempt.getStatus() != ExamAttemptStatus.IN_PROGRESS || !isExpired(attempt, now)) {
            return false;
        }
        gradeAndSubmit(attempt, now);
        attemptRepository.save(attempt);
        return true;
    }

    private boolean isExpired(ExamAttempt attempt, Instant now) {
        Instant deadline = attempt.getDeadlineAt() != null
            ? attempt.getDeadlineAt()
            : attempt.getStartedAt().plus(Duration.ofMinutes(attempt.getDurationMinutes()));
        return !now.isBefore(deadline);
    }

    private void ensureInProgress(ExamAttempt attempt) {
        if (attempt.getStatus() != ExamAttemptStatus.IN_PROGRESS) {
            throw new BadRequestException("Bài thi đã được nộp");
        }
    }

    private void applyAnswers(ExamAttempt attempt, List<SaveExamAnswerRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return;
        }

        Map<Long, Question> examQuestions = activeQuestions(attempt.getExam()).stream()
                .collect(Collectors.toMap(Question::getId, Function.identity()));
        Set<Long> seenQuestionIds = new HashSet<>();

        for (SaveExamAnswerRequest request : requests) {
            if (request == null || request.getQuestionId() == null) {
                throw new BadRequestException("ID câu hỏi không được để trống");
            }
            Long questionId = request.getQuestionId();
            if (!seenQuestionIds.add(questionId)) {
                throw new BadRequestException("Không được gửi nhiều câu trả lời cho cùng một câu hỏi");
            }
            Question question = examQuestions.get(questionId);
            if (question == null) {
                throw new BadRequestException("Câu hỏi không thuộc đề thi hoặc đã bị vô hiệu hóa");
            }

            Set<Long> selectedIds = request.getSelectedOptionIds() == null
                    ? Set.of()
                    : new HashSet<>(request.getSelectedOptionIds());
            if (request.getSelectedOptionIds() != null
                    && selectedIds.size() != request.getSelectedOptionIds().size()) {
                throw new BadRequestException("Không được gửi trùng lựa chọn");
            }

            Set<QuestionOption> selectedOptions = validateAndResolveOptions(question, selectedIds);
            String textAnswer = request.getTextAnswer();
            if (question.getType() == QuestionType.ESSAY) {
                if (!selectedIds.isEmpty()) {
                    throw new BadRequestException("Câu tự luận không nhận lựa chọn trắc nghiệm");
                }
            } else if (textAnswer != null && !textAnswer.isBlank()) {
                throw new BadRequestException("Câu trắc nghiệm không nhận câu trả lời dạng văn bản");
            }

            ExamAttemptAnswer answer = findOrCreateAnswer(attempt, question);
            answer.setSelectedOptions(selectedOptions);
            answer.setTextAnswer(question.getType() == QuestionType.ESSAY ? textAnswer : null);
        }
    }

    private Set<QuestionOption> validateAndResolveOptions(Question question, Set<Long> selectedIds) {
        if (question.getType() == QuestionType.ESSAY) {
            return Set.of();
        }
        if (question.getType() == QuestionType.SINGLE_CHOICE && selectedIds.size() > 1) {
            throw new BadRequestException("Câu hỏi chỉ cho phép chọn một đáp án");
        }

        Map<Long, QuestionOption> optionsById = question.getOptions().stream()
                .collect(Collectors.toMap(QuestionOption::getId, Function.identity()));
        if (!optionsById.keySet().containsAll(selectedIds)) {
            throw new BadRequestException("Có lựa chọn không thuộc câu hỏi");
        }
        return selectedIds.stream()
                .map(optionsById::get)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private ExamAttemptAnswer findOrCreateAnswer(ExamAttempt attempt, Question question) {
        return attempt.getAnswers().stream()
                .filter(answer -> answer.getQuestion().getId().equals(question.getId()))
                .findFirst()
                .orElseGet(() -> {
                    ExamAttemptAnswer answer = new ExamAttemptAnswer();
                    answer.setAttempt(attempt);
                    answer.setQuestion(question);
                    attempt.getAnswers().add(answer);
                    return answer;
                });
    }

    private void gradeAndSubmit(ExamAttempt attempt, Instant submittedAt) {
        int objectiveScore = 0;
        boolean hasEssay = false;
        Map<Long, Set<Long>> selectedByQuestion = attempt.getAnswers().stream()
                .collect(Collectors.toMap(
                        answer -> answer.getQuestion().getId(),
                        answer -> answer.getSelectedOptions().stream()
                                .map(QuestionOption::getId)
                                .collect(Collectors.toSet())
                ));

        for (Question question : activeQuestions(attempt.getExam())) {
            if (question.getType() == QuestionType.ESSAY) {
                hasEssay = true;
                continue;
            }
            Set<Long> correctIds = question.getOptions().stream()
                    .filter(QuestionOption::isCorrect)
                    .map(QuestionOption::getId)
                    .collect(Collectors.toSet());
            if (correctIds.equals(selectedByQuestion.getOrDefault(question.getId(), Set.of()))) {
                objectiveScore += question.getPoints();
            }
        }

        attempt.setObjectiveScore(objectiveScore);
        Integer penalty = attempt.isLateGraceEligible()
            && attempt.getOfficialDeadlineAt() != null
                && submittedAt.isAfter(attempt.getOfficialDeadlineAt())
            && attempt.getLatePolicy() == LatePolicy.ALLOWED_WITH_PENALTY
            ? attempt.getLatePenaltyPercent()
                : null;
        attempt.setLatePenaltyPercentApplied(penalty);
        attempt.setFinalScore(hasEssay ? null : applyPenalty(objectiveScore, penalty));
        attempt.setStatus(hasEssay ? ExamAttemptStatus.PENDING_REVIEW : ExamAttemptStatus.SUBMITTED);
        attempt.setSubmittedAt(submittedAt);
    }

    private Integer applyPenalty(int score, Integer penaltyPercent) {
        if (penaltyPercent == null) {
            return score;
        }
        return score * (100 - penaltyPercent) / 100;
    }

    private List<Question> activeQuestions(Exam exam) {
        return exam.getQuestions().stream()
                .filter(question -> Boolean.TRUE.equals(question.getIsActive()))
                .sorted(Comparator.comparing(Question::getId))
                .toList();
    }

    private ExamAttemptDTO toResponse(ExamAttempt attempt) {
        ExamAttemptDTO response = new ExamAttemptDTO();
        response.setId(attempt.getId());
        response.setExamId(attempt.getExam().getId());
        response.setAttemptNumber(attempt.getAttemptNumber());
        response.setTitle(attempt.getExam().getTitle());
        response.setDurationMinutes(attempt.getDurationMinutes());
        response.setTotalPoints(attempt.getTotalPoints());
        response.setObjectiveScore(attempt.getObjectiveScore());
        response.setFinalScore(attempt.getFinalScore());
        response.setStatus(attempt.getStatus());
        response.setStartedAt(attempt.getStartedAt());
        response.setOfficialDeadlineAt(attempt.getOfficialDeadlineAt());
        response.setDeadlineAt(attempt.getDeadlineAt() != null
            ? attempt.getDeadlineAt()
            : attempt.getStartedAt().plus(Duration.ofMinutes(attempt.getDurationMinutes())));
        response.setSubmittedAt(attempt.getSubmittedAt());
        response.setLate(attempt.getSubmittedAt() != null && attempt.getOfficialDeadlineAt() != null
            && attempt.getSubmittedAt().isAfter(attempt.getOfficialDeadlineAt()));
        response.setLatePenaltyPercentApplied(attempt.getLatePenaltyPercentApplied());
        List<ExamAttempt> attempts = attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(
            attempt.getExam().getId(), attempt.getStudent().getId());
        int attemptsUsed = Math.max(attempt.getAttemptNumber(), attempts.size());
        response.setAttemptsUsed(attemptsUsed);
        response.setAttemptsRemaining(Math.max(0, maxAttempts(attempt.getExam()) - attemptsUsed));
        response.setBestScore(bestScore(attempt, attempts));
        response.setQuestions(activeQuestions(attempt.getExam()).stream()
                .map(questionTakerMapper::toTakerResponse)
                .toList());
        response.setAnswers(attempt.getAnswers().stream()
                .sorted(Comparator.comparing(answer -> answer.getQuestion().getId()))
                .map(this::toAnswerResponse)
                .toList());
        return response;
    }

    private ExamAttemptDTO.AnswerDTO toAnswerResponse(ExamAttemptAnswer answer) {
        ExamAttemptDTO.AnswerDTO response = new ExamAttemptDTO.AnswerDTO();
        response.setQuestionId(answer.getQuestion().getId());
        response.setSelectedOptionIds(answer.getSelectedOptions().stream()
                .map(QuestionOption::getId)
                .sorted()
                .toList());
        response.setTextAnswer(answer.getTextAnswer());
        return response;
    }

    private ExamAttemptSummaryDTO toSummary(ExamAttempt attempt) {
        ExamAttemptSummaryDTO response = new ExamAttemptSummaryDTO();
        response.setId(attempt.getId());
        response.setExamId(attempt.getExam().getId());
        response.setAttemptNumber(attempt.getAttemptNumber());
        response.setStatus(attempt.getStatus());
        response.setObjectiveScore(attempt.getObjectiveScore());
        response.setFinalScore(attempt.getFinalScore());
        response.setTotalPoints(attempt.getTotalPoints());
        List<ExamAttempt> attempts = attempt.getStudent() == null
            ? List.of(attempt)
            : attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(
                attempt.getExam().getId(), attempt.getStudent().getId());
        int attemptsUsed = Math.max(attempt.getAttemptNumber(), attempts.size());
        response.setAttemptsUsed(attemptsUsed);
        response.setAttemptsRemaining(Math.max(0, maxAttempts(attempt.getExam()) - attemptsUsed));
        response.setBestScore(bestScore(attempt, attempts));
        return response;
    }

    private int maxAttempts(Exam exam) {
        return exam.getMaxAttempts() == null ? 1 : exam.getMaxAttempts();
    }

    private Integer bestScore(ExamAttempt current, List<ExamAttempt> attempts) {
        return attempts.stream()
                .filter(candidate -> candidate.getFinalScore() != null)
                .map(ExamAttempt::getFinalScore)
                .max(Integer::compareTo)
                .orElse(current.getFinalScore());
    }
}
