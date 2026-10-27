package com.example.starter_project_2025.system.exam.service;

import java.math.BigDecimal;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.EssayGradingDTO;
import com.example.starter_project_2025.system.exam.service.ai.AiEssayGradingClient;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExamEssayGradingService {

    static final Set<ExamAttemptStatus> NEEDS_REVIEW =
            Set.of(ExamAttemptStatus.PENDING_REVIEW, ExamAttemptStatus.EXPIRED);

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final AiEssayGradingClient aiClient;
    private final AnonymousExamService anonymousExamService;

    public List<EssayGradingDTO.Summary> listPending(Long examId) {
        requireExam(examId);
        return attemptRepository
                .findFinishedWithQuestionType(examId, NEEDS_REVIEW, QuestionType.ESSAY)
                .stream()
                .map(this::toSummary)
                .toList();
    }

    public EssayGradingDTO.Detail getDetail(Long examId, Long attemptId) {
        Exam exam = requireExam(examId);
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .filter(candidate -> candidate.getExam().getId().equals(examId))
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        if (attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS
                || attempt.getStatus() == ExamAttemptStatus.NOT_STARTED) {
            throw new BadRequestException("Bài làm chưa được nộp");
        }

        EssayGradingDTO.Detail detail = new EssayGradingDTO.Detail();
        detail.setAttemptId(attempt.getId());
        detail.setExamId(examId);
        detail.setExamTitle(exam.getTitle());
        fillStudent(attempt.getStudent(), detail::setStudentId, detail::setStudentName, detail::setStudentEmail);
        detail.setAttemptNumber(attempt.getAttemptNumber());
        detail.setStatus(attempt.getStatus());
        detail.setStartedAt(attempt.getStartedAt());
        detail.setSubmittedAt(attempt.getSubmittedAt());
        detail.setTotalPoints(attempt.getTotalPoints());
        detail.setMaxScore(ExamScoring.effectiveMax(attempt.getMaxScore()));
        detail.setObjectiveScore(attempt.getObjectiveScore());
        detail.setFinalScore(attempt.getFinalScore());
        detail.setAlreadyGraded(attempt.getFinalScore() != null || attempt.getStatus() == ExamAttemptStatus.SUBMITTED);
        detail.setEssays(attempt.getQuestions().stream()
                .filter(question -> question.getType() == QuestionType.ESSAY)
                .sorted(Comparator.comparingInt(ExamAttemptQuestion::getDisplayOrder))
                .map(question -> toEssayItem(attempt, question))
                .toList());
        return detail;
    }

    @Transactional
    public EssayGradingDTO.Detail submitOfficialGrade(
            Long examId,
            Long attemptId,
            EssayGradingDTO.GradeSubmissionRequest request
    ) {
        requireExam(examId);
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .filter(candidate -> candidate.getExam().getId().equals(examId))
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));

        if (attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS
                || attempt.getStatus() == ExamAttemptStatus.NOT_STARTED) {
            throw new BadRequestException("Bài làm chưa được nộp");
        }
        boolean alreadyGraded = attempt.getFinalScore() != null;

        if (alreadyGraded && !Boolean.TRUE.equals(request.getConfirmOverwrite())) {
            throw new BadRequestException(
                    "Attempt has already been graded. Explicit confirmation is required to overwrite official grade.");
        }
        if (!alreadyGraded
                && attempt.getStatus() != ExamAttemptStatus.SUBMITTED
                && !ExamAttemptLifecycle.canTransition(
                attempt.getStatus(),
                ExamAttemptStatus.SUBMITTED)) {
            throw new BadRequestException(
                    "Cannot grade attempt with status " + attempt.getStatus());
        }

        if (request.getGrades() == null || request.getGrades().isEmpty()) {
            throw new BadRequestException("Grades list cannot be empty");
        }

        Map<Long, EssayGradingDTO.QuestionGrade> gradeMap = new HashMap<>();
        for (EssayGradingDTO.QuestionGrade grade : request.getGrades()) {
            if (grade.getQuestionId() == null) {
                throw new BadRequestException("Question ID is required for each grade");
            }
            if (grade.getScore() != null && grade.getScore().signum() < 0) {
                throw new BadRequestException("Score cannot be negative");
            }
            gradeMap.put(grade.getQuestionId(), grade);
        }

        List<ExamAttemptQuestion> essayQuestions = attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.ESSAY)
                .toList();

        BigDecimal maxScore = ExamScoring.effectiveMax(attempt.getMaxScore());
        BigDecimal totalEssayScoreAwarded = BigDecimal.ZERO;

        for (ExamAttemptQuestion question : essayQuestions) {
            Long sourceQId = question.getSourceQuestionId();
            EssayGradingDTO.QuestionGrade grade = gradeMap.get(sourceQId);

            BigDecimal score = grade == null || grade.getScore() == null
                    ? BigDecimal.ZERO
                    : grade.getScore();

            BigDecimal cap = ExamScoring.gradingCap(maxScore, question.getPoints(), attempt.getTotalPoints());
            if (score.compareTo(cap) > 0) {
                throw new BadRequestException(
                        "Score (" + score.stripTrailingZeros().toPlainString() + ") for question " + question.getDisplayOrder() +
                                " exceeds maximum points (" + cap.stripTrailingZeros().toPlainString() + ")"
                );
            }
            BigDecimal stored = score.setScale(ExamScoring.STORE_SCALE, java.math.RoundingMode.HALF_UP);
            totalEssayScoreAwarded = totalEssayScoreAwarded.add(stored);

            ExamAttemptAnswer answer = findAnswer(attempt, question);
            if (answer == null) {
                answer = new ExamAttemptAnswer();
                answer.setAttempt(attempt);
                answer.setQuestion(question);
                answer.setTextAnswer("");
                attempt.getAnswers().add(answer);
            }
            answer.setScore(stored);
            answer.setFeedback(grade != null && grade.getFeedback() != null ? grade.getFeedback().trim() : "");
        }

        BigDecimal objectiveScore = attempt.getObjectiveScore() != null ? attempt.getObjectiveScore() : BigDecimal.ZERO;
        BigDecimal unpenalizedTotal = objectiveScore.add(totalEssayScoreAwarded);

        BigDecimal penalized = ExamScoring.applyPenalty(unpenalizedTotal, attempt.getLatePenaltyPercentApplied());
        attempt.setFinalScore(ExamScoring.clamp(penalized, maxScore));
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        attemptRepository.save(attempt);

        return getDetail(examId, attemptId);
    }

    public EssayGradingDTO.AiGradingResponse requestAiGrading(Long examId, Long attemptId) {
        return requestAiGrading(examId, attemptId, null);
    }

    public EssayGradingDTO.AiGradingResponse requestAiGrading(
            Long examId,
            Long attemptId,
            EssayGradingDTO.AiGradingRequest request
    ) {
        requireExam(examId);
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .filter(candidate -> candidate.getExam().getId().equals(examId))
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));

        if (attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS
                || attempt.getStatus() == ExamAttemptStatus.NOT_STARTED) {
            throw new BadRequestException("Bài làm chưa được nộp");
        }

        List<AiEssayGradingClient.EssayQuestionPayload> payloads = attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.ESSAY)
                .sorted(Comparator.comparingInt(ExamAttemptQuestion::getDisplayOrder))
                .map(q -> {
                    String refAnswer = null;
                    String rubric = null;
                    if (request != null && request.getQuestions() != null) {
                        EssayGradingDTO.QuestionContext ctx = request.getQuestions().get(q.getSourceQuestionId());
                        if (ctx != null) {
                            refAnswer = ctx.getReferenceAnswer();
                            rubric = ctx.getRubric();
                        }
                    }
                    BigDecimal maxPoints = ExamScoring.gradingCap(
                            ExamScoring.effectiveMax(attempt.getMaxScore()),
                            q.getPoints(),
                            attempt.getTotalPoints()
                    );
                    return new AiEssayGradingClient.EssayQuestionPayload(
                            q.getSourceQuestionId(),
                            q.getDisplayOrder(),
                            q.getContent(),
                            maxPoints,
                            answerText(attempt, q),
                            refAnswer,
                            rubric
                    );
                })
                .toList();

        return aiClient.requestProposal(payloads);
    }


    private Exam requireExam(Long examId) {
        return examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
    }

    private EssayGradingDTO.Summary toSummary(ExamAttempt attempt) {
        EssayGradingDTO.Summary summary = new EssayGradingDTO.Summary();
        summary.setAttemptId(attempt.getId());
        fillStudent(attempt.getStudent(), summary::setStudentId, summary::setStudentName, summary::setStudentEmail);
        summary.setAttemptNumber(attempt.getAttemptNumber());
        summary.setStatus(attempt.getStatus());
        summary.setSubmittedAt(attempt.getSubmittedAt());
        List<ExamAttemptQuestion> essays = attempt.getQuestions().stream()
                .filter(question -> question.getType() == QuestionType.ESSAY)
                .toList();
        summary.setEssayCount(essays.size());
        summary.setEssayAnswered((int) essays.stream()
                .filter(question -> !answerText(attempt, question).isBlank())
                .count());
        return summary;
    }

    private EssayGradingDTO.EssayItem toEssayItem(ExamAttempt attempt, ExamAttemptQuestion question) {
        EssayGradingDTO.EssayItem item = new EssayGradingDTO.EssayItem();
        item.setQuestionId(question.getSourceQuestionId());
        item.setDisplayOrder(question.getDisplayOrder());
        item.setContent(question.getContent());
        item.setPoints(question.getPoints());
        item.setMaxScore(ExamScoring.gradingCap(ExamScoring.effectiveMax(attempt.getMaxScore()), question.getPoints(), attempt.getTotalPoints()));
        item.setAnswerText(answerText(attempt, question));

        ExamAttemptAnswer answer = findAnswer(attempt, question);
        if (answer != null) {
            item.setScore(answer.getScore());
            item.setFeedback(answer.getFeedback());
        }

        return item;
    }

    private ExamAttemptAnswer findAnswer(ExamAttempt attempt, ExamAttemptQuestion question) {
        return attempt.getAnswers().stream()
                .filter((ExamAttemptAnswer answer) -> answer.getQuestion().getId().equals(question.getId()))
                .findFirst()
                .orElse(null);
    }

    private String answerText(ExamAttempt attempt, ExamAttemptQuestion question) {
        ExamAttemptAnswer answer = findAnswer(attempt, question);
        return answer != null && answer.getTextAnswer() != null ? answer.getTextAnswer() : "";
    }

    private void fillStudent(User student,
                             java.util.function.Consumer<Long> id,
                             java.util.function.Consumer<String> name,
                             java.util.function.Consumer<String> email) {
        if (student == null) {
            return;
        }
        id.accept(student.getId());
        String last = student.getLastName() == null ? "" : student.getLastName().trim();
        name.accept((student.getFirstName() + " " + last).trim());
        email.accept(student.getEmail());
    }
}
