package com.example.starter_project_2025.system.exam.service;

import java.math.BigDecimal;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.EssayGradingDTO;
import com.example.starter_project_2025.system.question.domain.EssayGradingCriterion;
import com.example.starter_project_2025.system.exam.service.ai.AiEssayGradingClient;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.CodeSpecDTO;
import com.example.starter_project_2025.system.question.service.CodeSpecSupport;
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

    /** Cac bai da nop: giao vien xem/cham duoc ca bai da cham xong. */
    static final Set<ExamAttemptStatus> SUBMITTED_STATES =
            Set.of(ExamAttemptStatus.PENDING_REVIEW, ExamAttemptStatus.EXPIRED, ExamAttemptStatus.SUBMITTED);

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final AiEssayGradingClient aiClient;
    private final AnonymousExamService anonymousExamService;
    private final CodeJudgeService codeJudgeService;

    public List<EssayGradingDTO.Summary> listPending(Long examId) {
        requireExam(examId);
        return attemptRepository
                .findFinishedWithAnyQuestionType(examId, SUBMITTED_STATES,
                        List.of(QuestionType.ESSAY, QuestionType.CODING))
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
        detail.setScoreAdjusted(attempt.getFirstScore() != null);
        detail.setAlreadyGraded(attempt.getFinalScore() != null || attempt.getStatus() == ExamAttemptStatus.SUBMITTED);
        detail.setEssays(attempt.getQuestions().stream()
                .filter(question -> question.getType() == QuestionType.ESSAY)
                .sorted(Comparator.comparingInt(ExamAttemptQuestion::getDisplayOrder))
                .map(question -> toEssayItem(attempt, question))
                .toList());
        detail.setCodings(attempt.getQuestions().stream()
                .filter(question -> question.getType() == QuestionType.CODING)
                .sorted(Comparator.comparingInt(ExamAttemptQuestion::getDisplayOrder))
                .map(question -> toCodingItem(attempt, question))
                .toList());
        return detail;
    }

    /** Chay thu toan bo test (ca an) tren code sinh vien nop; khong luu gi. */
    public EssayGradingDTO.CodingRunResult runCodingTests(Long examId, Long attemptId, Long questionId) {
        requireExam(examId);
        ExamAttempt attempt = requireSubmittedAttempt(examId, attemptId);
        ExamAttemptQuestion question = requireCodingQuestion(attempt, questionId);
        CodeSpecDTO spec = requireSpec(question);
        List<CodeJudgeService.TestResult> results = codeJudgeService.runAll(spec, answerText(attempt, question));

        EssayGradingDTO.CodingRunResult run = new EssayGradingDTO.CodingRunResult();
        List<EssayGradingDTO.CodingTestResult> items = new ArrayList<>();
        int passed = 0;
        for (int i = 0; i < results.size(); i++) {
            CodeJudgeService.TestResult r = results.get(i);
            CodeSpecDTO.TestCase t = spec.getTests().get(i);
            EssayGradingDTO.CodingTestResult item = new EssayGradingDTO.CodingTestResult();
            item.setIndex(i);
            item.setVisible(t.isVisible());
            item.setPassed(r.passed());
            item.setStatus(r.status());
            item.setInputs(t.getInputs());
            item.setExpected(t.getExpected());
            item.setActual(r.actual());
            item.setError(r.error());
            if (r.passed()) passed++;
            if (r.infraError()) run.setInfraError(true);
            items.add(item);
        }
        run.setPassed(passed);
        run.setTotal(items.size());
        run.setTests(items);
        return run;
    }

    /** Cham lai mot cau lap trinh bang may cham, luu diem va cap nhat diem bai thi. */
    @Transactional
    public EssayGradingDTO.Detail regradeCoding(Long examId, Long attemptId, Long questionId) {
        requireExam(examId);
        ExamAttempt attempt = requireSubmittedAttempt(examId, attemptId);
        ExamAttemptQuestion question = requireCodingQuestion(attempt, questionId);
        CodeSpecDTO spec = requireSpec(question);
        if (attempt.getFirstScore() != null) {
            throw new BadRequestException("Bài này đã được sửa điểm tay (điểm 1/điểm 2) nên không thể chấm lại "
                    + "coding tự động, để tránh ghi đè điểm của giáo viên.");
        }

        ExamAttemptAnswer answer = findAnswer(attempt, question);
        if (answer == null) {
            answer = new ExamAttemptAnswer();
            answer.setAttempt(attempt);
            answer.setQuestion(question);
            answer.setTextAnswer("");
            attempt.getAnswers().add(answer);
        }
        CodeJudgeService.GradeResult result = codeJudgeService.grade(spec, answer.getTextAnswer());
        if (result.infraError()) {
            throw new BadRequestException("Máy chấm code không phản hồi. Hãy kiểm tra Judge0 rồi thử lại.");
        }

        BigDecimal maxScore = ExamScoring.effectiveMax(attempt.getMaxScore());
        BigDecimal weight = BigDecimal.valueOf(question.getPoints())
                .multiply(BigDecimal.valueOf(result.passed()))
                .divide(BigDecimal.valueOf(result.total()), 8, java.math.RoundingMode.HALF_UP);
        BigDecimal newScore = ExamScoring.share(maxScore, weight, attempt.getTotalPoints());
        BigDecimal oldScore = answer.getScore() == null ? BigDecimal.ZERO : answer.getScore();
        answer.setScore(newScore);
        answer.setFeedback("Đạt " + result.passed() + "/" + result.total() + " test"
                + (result.compileError() != null ? " (lỗi biên dịch)" : ""));
        answer.setCodeResult(CodingScoring.statusesJson(result));
        answer.setGradeAttempts(0);
        answer.setNextGradeAt(null);

        BigDecimal objective = (attempt.getObjectiveScore() == null ? BigDecimal.ZERO : attempt.getObjectiveScore())
                .add(newScore).subtract(oldScore).max(BigDecimal.ZERO);
        attempt.setObjectiveScore(objective.setScale(ExamScoring.STORE_SCALE, java.math.RoundingMode.HALF_UP));
        recomputeFinalScore(attempt, maxScore);
        attemptRepository.save(attempt);
        return getDetail(examId, attemptId);
    }

    private void recomputeFinalScore(ExamAttempt attempt, BigDecimal maxScore) {
        boolean hasEssay = attempt.getQuestions().stream().anyMatch(q -> q.getType() == QuestionType.ESSAY);
        boolean codePending = attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.CODING)
                .anyMatch(q -> {
                    ExamAttemptAnswer a = findAnswer(attempt, q);
                    return a == null || a.getScore() == null;
                });
        BigDecimal essayTotal = attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.ESSAY)
                .map(q -> {
                    ExamAttemptAnswer a = findAnswer(attempt, q);
                    return a == null || a.getScore() == null ? BigDecimal.ZERO : a.getScore();
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal total = attempt.getObjectiveScore().add(essayTotal);

        if (attempt.getFinalScore() != null) {
            attempt.setFinalScore(ExamScoring.clamp(
                    ExamScoring.applyPenalty(total, attempt.getLatePenaltyPercentApplied()), maxScore));
        } else if (!hasEssay && !codePending) {
            attempt.setFinalScore(ExamScoring.clamp(
                    ExamScoring.applyPenalty(attempt.getObjectiveScore(), attempt.getLatePenaltyPercentApplied()), maxScore));
            if (attempt.getStatus() != ExamAttemptStatus.SUBMITTED
                    && ExamAttemptLifecycle.canTransition(attempt.getStatus(), ExamAttemptStatus.SUBMITTED)) {
                attempt.setStatus(ExamAttemptStatus.SUBMITTED);
            }
        }
    }

    private ExamAttempt requireSubmittedAttempt(Long examId, Long attemptId) {
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .filter(candidate -> candidate.getExam().getId().equals(examId))
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        if (attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS
                || attempt.getStatus() == ExamAttemptStatus.NOT_STARTED) {
            throw new BadRequestException("Bài làm chưa được nộp");
        }
        return attempt;
    }

    private ExamAttemptQuestion requireCodingQuestion(ExamAttempt attempt, Long sourceQuestionId) {
        return attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.CODING
                        && java.util.Objects.equals(q.getSourceQuestionId(), sourceQuestionId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Coding question not found in this attempt"));
    }

    private CodeSpecDTO requireSpec(ExamAttemptQuestion question) {
        CodeSpecDTO spec = CodeSpecSupport.fromJson(question.getCodeSpec());
        if (spec == null || spec.getTests() == null || spec.getTests().isEmpty()) {
            throw new BadRequestException("Câu hỏi chưa có test case");
        }
        return spec;
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
                    String rubric = formatGradingCriteria(q.getGradingCriteria());
                    if (request != null && request.getQuestions() != null) {
                        EssayGradingDTO.QuestionContext ctx = request.getQuestions().get(q.getSourceQuestionId());
                        if (ctx != null) {
                            refAnswer = ctx.getReferenceAnswer();
                            if (ctx.getRubric() != null && !ctx.getRubric().isBlank()) {
                                rubric = rubric == null ? ctx.getRubric().trim()
                                        : rubric + "\n\nAdditional teacher guidance:\n" + ctx.getRubric().trim();
                            }
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

    private String formatGradingCriteria(List<EssayGradingCriterion> criteria) {
        if (criteria == null || criteria.isEmpty()) return null;
        return criteria.stream()
                .map(criterion -> criterion.getName() + " (" + criterion.getWeightPercentage() + "%)"
                        + (criterion.getDescription() == null || criterion.getDescription().isBlank()
                        ? "" : ": " + criterion.getDescription().trim()))
                .collect(java.util.stream.Collectors.joining("\n"));
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
        List<ExamAttemptQuestion> codings = attempt.getQuestions().stream()
                .filter(question -> question.getType() == QuestionType.CODING)
                .toList();
        summary.setCodingCount(codings.size());
        summary.setCodingAnswered((int) codings.stream()
                .filter(question -> !answerText(attempt, question).isBlank())
                .count());
        return summary;
    }

    private EssayGradingDTO.CodingItem toCodingItem(ExamAttempt attempt, ExamAttemptQuestion question) {
        EssayGradingDTO.CodingItem item = new EssayGradingDTO.CodingItem();
        item.setQuestionId(question.getSourceQuestionId());
        item.setDisplayOrder(question.getDisplayOrder());
        item.setContent(question.getContent());
        item.setPoints(question.getPoints());
        item.setMaxScore(ExamScoring.gradingCap(ExamScoring.effectiveMax(attempt.getMaxScore()), question.getPoints(), attempt.getTotalPoints()));
        item.setCode(answerText(attempt, question));
        item.setSpec(CodeSpecSupport.forTeacher(question.getCodeSpec()));
        ExamAttemptAnswer answer = findAnswer(attempt, question);
        if (answer != null) {
            item.setScore(answer.getScore());
            item.setFeedback(answer.getFeedback());
            if (answer.getScore() == null) {
                item.setAutoGradeState(answer.getGradeAttempts() >= CodingGradingService.MAX_AUTO_ATTEMPTS
                        ? "FAILED"
                        : (answer.getGradeAttempts() > 0 ? "RETRYING" : "PENDING"));
            }
        }
        return item;
    }

    private EssayGradingDTO.EssayItem toEssayItem(ExamAttempt attempt, ExamAttemptQuestion question) {
        EssayGradingDTO.EssayItem item = new EssayGradingDTO.EssayItem();
        item.setQuestionId(question.getSourceQuestionId());
        item.setDisplayOrder(question.getDisplayOrder());
        item.setContent(question.getContent());
        item.setPoints(question.getPoints());
        item.setMaxScore(ExamScoring.gradingCap(ExamScoring.effectiveMax(attempt.getMaxScore()), question.getPoints(), attempt.getTotalPoints()));
        item.setAnswerText(answerText(attempt, question));
        item.setGradingCriteria(question.getGradingCriteria().stream().map(criterion -> {
            EssayGradingDTO.GradingCriterion dto = new EssayGradingDTO.GradingCriterion();
            dto.setName(criterion.getName());
            dto.setDescription(criterion.getDescription());
            dto.setWeightPercentage(criterion.getWeightPercentage());
            return dto;
        }).toList());

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
