package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptDTO;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptSummaryDTO;
import com.example.starter_project_2025.system.exam.dto.SaveExamAnswerRequest;

import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionType;
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
    private final UserRepository userRepository;
    private final QuestionTakerMapper questionTakerMapper;

    public ExamAttemptDTO startOrResume(Long examId, Long studentId) {
        return startOrResume(examId, studentId, null);
    }

    public ExamAttemptDTO startOrResume(Long examId, Long studentId, String password) {
        Exam exam = examRepository.lockForAttemptStart(examId)
                .filter(candidate -> Boolean.TRUE.equals(candidate.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
        LocalDateTime nowLocal = LocalDateTime.now();

        List<ExamAttempt> attempts = attemptRepository
                .findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(examId, studentId);
        Optional<ExamAttempt> existing = attempts.stream()
                .filter(candidate -> candidate.getStatus() == ExamAttemptStatus.IN_PROGRESS)
                .max(Comparator.comparingInt(ExamAttempt::getAttemptNumber));
        if (existing.isPresent()) {
            ExamAttempt attempt = existing.get();
            expireIfOverdue(attempt.getId(), Instant.now());
            return toResponse(attempt);
        }

        ensureExamWindowOpen(exam, nowLocal);
        ensureExamPasswordValid(exam, password);

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
        snapshotQuestions(attempt, exam, questions);
        return toResponse(attemptRepository.save(attempt));
    }

    private void snapshotQuestions(ExamAttempt attempt, Exam exam, List<Question> source) {
        List<Question> ordered = new ArrayList<>(source);
        if (Boolean.TRUE.equals(exam.getShuffleQuestions())) {
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
            snap.setDisplayOrder(questionOrder++);

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

    private void ensureExamWindowOpen(Exam exam, LocalDateTime now) {
        if (exam.getStartTime() != null && now.isBefore(exam.getStartTime())) {
            throw new BadRequestException("Kỳ thi chưa đến giờ mở");
        }
        if (exam.getEndTime() != null && !now.isBefore(exam.getEndTime())) {
            throw new BadRequestException("Kỳ thi đã đóng");
        }
    }

    public List<ExamAttemptSummaryDTO> findStudentAttempts(Long studentId) {
        Instant now = Instant.now();
        List<ExamAttempt> attempts = attemptRepository.findAllByStudent_IdOrderByStartedAtDesc(studentId);
        for (ExamAttempt attempt : attempts) {
            if (attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS && isExpired(attempt, now)) {
                expireIfOverdue(attempt.getId(), now);
            }
        }
        return attempts.stream()
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
        switch (ExamAttemptLifecycle.decideSave(attempt.getStatus(), isExpired(attempt, now))) {
            case APPLY -> {
                applyAnswers(attempt, requests);
                attemptRepository.save(attempt);
            }
            case EXPIRE -> expire(attempt);
            case IGNORE -> { }
        }
        return toResponse(attempt);
    }

    public ExamAttemptDTO submit(
            Long attemptId,
            Long studentId,
            List<SaveExamAnswerRequest> requests
    ) {
        ExamAttempt attempt = findLockedAttempt(attemptId, studentId);
        Instant now = Instant.now();
        switch (ExamAttemptLifecycle.decideSubmit(attempt.getStatus(), isExpired(attempt, now))) {
            case GRADE_WITH_ANSWERS -> {
                applyAnswers(attempt, requests);
                gradeAndSubmit(attempt, now, false);
                attemptRepository.save(attempt);
            }
            case GRADE_AS_EXPIRED -> expire(attempt);
            case RETURN_CURRENT -> { }
        }
        return toResponse(attempt);
    }

    public boolean expireIfOverdue(Long attemptId, Instant now) {
        Optional<ExamAttempt> locked = attemptRepository.lockById(attemptId);
        if (locked.isEmpty()) {
            return false;
        }
        ExamAttempt attempt = locked.get();
        if (attempt.getStatus() != ExamAttemptStatus.IN_PROGRESS || !isExpired(attempt, now)) {
            return false;
        }
        expire(attempt);
        return true;
    }

    private ExamAttempt findLockedAttempt(Long attemptId, Long studentId) {
        return attemptRepository.lockByIdAndStudentId(attemptId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
    }

    private void expire(ExamAttempt attempt) {
        gradeAndSubmit(attempt, deadlineOf(attempt), true);
        attemptRepository.save(attempt);
    }

    private Instant deadlineOf(ExamAttempt attempt) {
        return attempt.getDeadlineAt() != null
                ? attempt.getDeadlineAt()
                : attempt.getStartedAt().plus(Duration.ofMinutes(attempt.getDurationMinutes()));
    }

    private boolean isExpired(ExamAttempt attempt, Instant now) {
        return ExamAttemptLifecycle.isExpired(deadlineOf(attempt), now);
    }

    private void applyAnswers(ExamAttempt attempt, List<SaveExamAnswerRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return;
        }

        Map<Long, ExamAttemptQuestion> bySourceId = attempt.getQuestions().stream()
                .collect(Collectors.toMap(ExamAttemptQuestion::getSourceQuestionId, Function.identity()));
        Set<Long> seenQuestionIds = new HashSet<>();

        for (SaveExamAnswerRequest request : requests) {
            if (request == null || request.getQuestionId() == null) {
                throw new BadRequestException("ID câu hỏi không được để trống");
            }
            Long questionId = request.getQuestionId();
            if (!seenQuestionIds.add(questionId)) {
                throw new BadRequestException("Không được gửi nhiều câu trả lời cho cùng một câu hỏi");
            }
            ExamAttemptQuestion question = bySourceId.get(questionId);
            if (question == null) {
                throw new BadRequestException("Câu hỏi không thuộc bài làm này");
            }

            Set<Long> selectedIds = request.getSelectedOptionIds() == null
                    ? Set.of()
                    : new HashSet<>(request.getSelectedOptionIds());
            if (request.getSelectedOptionIds() != null
                    && selectedIds.size() != request.getSelectedOptionIds().size()) {
                throw new BadRequestException("Không được gửi trùng lựa chọn");
            }

            Set<ExamAttemptOption> selectedOptions = validateAndResolveOptions(question, selectedIds);
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

    private Set<ExamAttemptOption> validateAndResolveOptions(ExamAttemptQuestion question, Set<Long> selectedIds) {
        if (question.getType() == QuestionType.ESSAY) {
            return new LinkedHashSet<>();
        }

        long correctCount = question.getOptions().stream().filter(ExamAttemptOption::isCorrect).count();
        if (correctCount <= 1 && selectedIds.size() > 1) {
            throw new BadRequestException("Câu hỏi chỉ cho phép chọn một đáp án");
        }

        Map<Long, ExamAttemptOption> optionsBySourceId = question.getOptions().stream()
                .collect(Collectors.toMap(ExamAttemptOption::getSourceOptionId, Function.identity()));
        if (!optionsBySourceId.keySet().containsAll(selectedIds)) {
            throw new BadRequestException("Có lựa chọn không thuộc câu hỏi");
        }
        return selectedIds.stream()
                .map(optionsBySourceId::get)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private ExamAttemptAnswer findOrCreateAnswer(ExamAttempt attempt, ExamAttemptQuestion question) {
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

    private void gradeAndSubmit(ExamAttempt attempt, Instant submittedAt, boolean expired) {
        int objectiveScore = 0;
        boolean hasEssay = false;

        Map<Long, Set<Long>> selectedByQuestion = new HashMap<>();
        for (ExamAttemptAnswer answer : attempt.getAnswers()) {
            selectedByQuestion.put(
                    answer.getQuestion().getSourceQuestionId(),
                    answer.getSelectedOptions().stream()
                            .map(ExamAttemptOption::getSourceOptionId)
                            .collect(Collectors.toSet()));
        }

        for (ExamAttemptQuestion question : attempt.getQuestions()) {
            if (question.getType() == QuestionType.ESSAY) {
                hasEssay = true;
                continue;
            }
            Set<Long> correctIds = question.getOptions().stream()
                    .filter(ExamAttemptOption::isCorrect)
                    .map(ExamAttemptOption::getSourceOptionId)
                    .collect(Collectors.toSet());
            if (correctIds.equals(selectedByQuestion.getOrDefault(question.getSourceQuestionId(), Set.of()))) {
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
        attempt.setStatus(ExamAttemptLifecycle.finalStatus(hasEssay, expired));
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
        response.setQuestions(attempt.getQuestions().stream()
                .map(questionTakerMapper::toTakerResponse)
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
        return response;
    }

    private ExamAttemptSummaryDTO toSummary(ExamAttempt attempt) {
        ExamAttemptSummaryDTO response = new ExamAttemptSummaryDTO();
        response.setId(attempt.getId());
        response.setExamId(attempt.getExam().getId());
        response.setAttemptNumber(attempt.getAttemptNumber());
        response.setStatus(attempt.getStatus());
        response.setTotalPoints(attempt.getTotalPoints());
        response.setStartedAt(attempt.getStartedAt());
        response.setDeadlineAt(deadlineOf(attempt));
        response.setSubmittedAt(attempt.getSubmittedAt());
        List<ExamAttempt> attempts = attempt.getStudent() == null
                ? List.of(attempt)
                : attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(
                attempt.getExam().getId(), attempt.getStudent().getId());
        int attemptsUsed = Math.max(attempt.getAttemptNumber(), attempts.size());
        response.setAttemptsUsed(attemptsUsed);
        response.setAttemptsRemaining(Math.max(0, maxAttempts(attempt.getExam()) - attemptsUsed));
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

    private void ensureExamPasswordValid(Exam exam, String password) {
        if (exam.getAccessCode() != null && !exam.getAccessCode().trim().isEmpty()) {
            if (password == null || !exam.getAccessCode().trim().equals(password.trim())) {
                throw new BadRequestException("Mật khẩu đề thi không chính xác");
            }
        }
    }
}