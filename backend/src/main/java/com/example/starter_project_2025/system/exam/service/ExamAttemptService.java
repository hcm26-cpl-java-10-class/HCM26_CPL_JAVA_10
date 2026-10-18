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
        Optional<ExamAttempt> existing = attemptRepository.findByExam_IdAndStudent_Id(examId, studentId);
        if (existing.isPresent()) {
            ExamAttempt attempt = existing.get();
            submitIfExpired(attempt, Instant.now());
            return toResponse(attempt);
        }

        Exam exam = examRepository.findById(examId)
                .filter(candidate -> Boolean.TRUE.equals(candidate.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
        List<Question> questions = activeQuestions(exam);
        if (questions.isEmpty()) {
            throw new BadRequestException("Đề thi chưa có câu hỏi đang hoạt động");
        }

        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));
        ExamAttempt attempt = new ExamAttempt();
        attempt.setExam(exam);
        attempt.setStudent(student);
        attempt.setDurationMinutes(exam.getDurationMinutes());
        attempt.setTotalPoints(questions.stream().mapToInt(Question::getPoints).sum());
        attempt.setStartedAt(Instant.now());
        attempt.setStatus(ExamAttemptStatus.IN_PROGRESS);
        snapshotQuestions(attempt, exam, questions);
        return toResponse(attemptRepository.save(attempt));
    }

    public List<ExamAttemptSummaryDTO> findStudentAttempts(Long studentId) {
        return attemptRepository.findAllByStudent_IdOrderByStartedAtDesc(studentId).stream()
                .map(this::toSummary)
                .toList();
    }

    public ExamAttemptDTO saveAnswers(Long attemptId, Long studentId, List<SaveExamAnswerRequest> requests) {
        ExamAttempt attempt = findLockedAttempt(attemptId, studentId);
        if (submitIfExpired(attempt, Instant.now())) {
            return toResponse(attempt);
        }
        ensureInProgress(attempt);
        applyAnswers(attempt, requests);
        return toResponse(attemptRepository.save(attempt));
    }

    public ExamAttemptDTO submit(Long attemptId, Long studentId, List<SaveExamAnswerRequest> requests) {
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

    // ===== BR-UNI-16: snapshot questions/options/correct/points at start, apply shuffle once =====
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
                snapOption.setCorrect(o.isCorrect());
                snapOption.setDisplayOrder(optionOrder++);
                snap.getOptions().add(snapOption);
            }
            attempt.getQuestions().add(snap);
        }
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
        Instant deadline = attempt.getStartedAt().plus(Duration.ofMinutes(attempt.getDurationMinutes()));
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
            return Set.of();
        }
        if (question.getType() == QuestionType.SINGLE_CHOICE && selectedIds.size() > 1) {
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

    private void gradeAndSubmit(ExamAttempt attempt, Instant submittedAt) {
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
        attempt.setFinalScore(hasEssay ? null : objectiveScore);
        attempt.setStatus(hasEssay ? ExamAttemptStatus.PENDING_REVIEW : ExamAttemptStatus.SUBMITTED);
        attempt.setSubmittedAt(submittedAt);
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
        response.setTitle(attempt.getExam().getTitle());
        response.setDurationMinutes(attempt.getDurationMinutes());
        response.setTotalPoints(attempt.getTotalPoints());
        response.setObjectiveScore(attempt.getObjectiveScore());
        response.setFinalScore(attempt.getFinalScore());
        response.setStatus(attempt.getStatus());
        response.setStartedAt(attempt.getStartedAt());
        response.setDeadlineAt(attempt.getStartedAt().plus(Duration.ofMinutes(attempt.getDurationMinutes())));
        response.setSubmittedAt(attempt.getSubmittedAt());
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
        response.setExamId(attempt.getExam().getId());
        response.setStatus(attempt.getStatus());
        response.setObjectiveScore(attempt.getObjectiveScore());
        response.setFinalScore(attempt.getFinalScore());
        response.setTotalPoints(attempt.getTotalPoints());
        return response;
    }
}