package com.example.starter_project_2025.system.exam.grading.service;

import java.math.BigDecimal;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.grading.domain.AiEssayGradingState;
import com.example.starter_project_2025.system.exam.grading.domain.ExamQuestionGradingConfig;
import com.example.starter_project_2025.system.exam.grading.domain.ExamQuestionGradingConfigRepository;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.grading.dto.EssayGradingDTO;
import com.example.starter_project_2025.system.question.core.domain.EssayGradingCriterion;
import com.example.starter_project_2025.system.exam.ai.AiEssayGradingClient;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;
import com.example.starter_project_2025.system.question.core.dto.CodeSpecDTO;
import com.example.starter_project_2025.system.question.core.service.CodeSpecSupport;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.security.UserPrincipal;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import com.example.starter_project_2025.system.exam.attempt.service.ExamAttemptLifecycle;
import com.example.starter_project_2025.system.exam.code.CodingGradingService;
import com.example.starter_project_2025.system.exam.code.CodingScoring;
import com.example.starter_project_2025.system.exam.invitation.service.AnonymousExamService;

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
    private final ExamQuestionGradingConfigRepository gradingConfigRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.example.starter_project_2025.system.notification.NotificationService notificationService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private UserRepository userRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

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
        detail.setAiGradingState(resolveAiGradingState(attempt));
        detail.setAiProposedEssayScore(resolveAiProposedEssayScore(attempt));
        detail.setAiGradedAt(attempt.getAiGradedAt());
        detail.setAiGradingError(attempt.getAiGradingError());
        detail.setConfirmedBy(attempt.getConfirmedBy());
        detail.setConfirmedAt(attempt.getConfirmedAt());
        detail.setMaxEssayScore(computeMaxEssayScore(attempt));
        detail.setLowScoreFlagged(isLowScoreOrFailFlagged(attempt));
        detail.setLowScoreReason(resolveLowScoreReason(attempt));
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

    /** Lay thong tin Reference va Rubric da luu cho mot cau hoi trong ky thi. */
    public EssayGradingDTO.QuestionGuidelineDTO getQuestionGuidelines(Long examId, Long questionId) {
        requireExam(examId);
        ExamQuestionGradingConfig config = gradingConfigRepository
                .findByExamIdAndQuestionId(examId, questionId)
                .orElse(null);
        return toGuidelineDTO(examId, questionId, config);
    }

    /** Luu Reference / Model Answer cho mot cau hoi trong ky thi. */
    @Transactional
    public EssayGradingDTO.QuestionGuidelineDTO submitReferenceAnswer(Long examId, Long questionId, String referenceAnswer) {
        requireExam(examId);
        ExamQuestionGradingConfig config = gradingConfigRepository
                .findByExamIdAndQuestionId(examId, questionId)
                .orElseGet(() -> ExamQuestionGradingConfig.builder()
                        .examId(examId)
                        .questionId(questionId)
                        .build());
        config.setReferenceAnswer(referenceAnswer != null ? referenceAnswer.trim() : "");
        config.setReferenceSubmittedAt(Instant.now());
        config = gradingConfigRepository.save(config);
        return toGuidelineDTO(examId, questionId, config);
    }

    /** Luu Grading Rubric & Criteria cho mot cau hoi trong ky thi. */
    @Transactional
    public EssayGradingDTO.QuestionGuidelineDTO submitRubric(Long examId, Long questionId, String rubric) {
        requireExam(examId);
        ExamQuestionGradingConfig config = gradingConfigRepository
                .findByExamIdAndQuestionId(examId, questionId)
                .orElseGet(() -> ExamQuestionGradingConfig.builder()
                        .examId(examId)
                        .questionId(questionId)
                        .build());
        config.setRubric(rubric != null ? rubric.trim() : "");
        config.setRubricSubmittedAt(Instant.now());
        config = gradingConfigRepository.save(config);
        return toGuidelineDTO(examId, questionId, config);
    }

    private EssayGradingDTO.QuestionGuidelineDTO toGuidelineDTO(Long examId, Long questionId, ExamQuestionGradingConfig config) {
        EssayGradingDTO.QuestionGuidelineDTO dto = new EssayGradingDTO.QuestionGuidelineDTO();
        dto.setExamId(examId);
        dto.setQuestionId(questionId);
        if (config != null) {
            dto.setReferenceAnswer(config.getReferenceAnswer());
            dto.setReferenceSubmittedAt(config.getReferenceSubmittedAt());
            dto.setRubric(config.getRubric());
            dto.setRubricSubmittedAt(config.getRubricSubmittedAt());
        }
        return dto;
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
        freezeGuidelines(examId, attempt);

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
            answer.setAiGradingStatus(AiEssayGradingState.CONFIRMED.name());
        }

        BigDecimal objectiveScore = attempt.getObjectiveScore() != null ? attempt.getObjectiveScore() : BigDecimal.ZERO;
        BigDecimal unpenalizedTotal = objectiveScore.add(totalEssayScoreAwarded);

        BigDecimal penalized = ExamScoring.applyPenalty(unpenalizedTotal, attempt.getLatePenaltyPercentApplied());
        attempt.setFinalScore(ExamScoring.clamp(penalized, maxScore));
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        attempt.setAiGradingState(AiEssayGradingState.CONFIRMED);
        attempt.setConfirmedAt(Instant.now());
        Long currentUserId = currentUserIdOrNull();
        if (currentUserId != null) {
            attempt.setConfirmedBy(currentUserId);
        }
        attempt.setRevisionNote(null);
        attempt.setRevisionDeadline(null);
        attemptRepository.save(attempt);

        return getDetail(examId, attemptId);
    }

    @Transactional
    public EssayGradingDTO.Detail returnForRevision(
            Long examId,
            Long attemptId,
            com.example.starter_project_2025.system.exam.grading.dto.ReturnForRevisionRequest request
    ) {
        requireExam(examId);
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .filter(candidate -> candidate.getExam().getId().equals(examId))
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));

        if (!ExamAttemptLifecycle.canTransition(attempt.getStatus(), ExamAttemptStatus.RETURNED_FOR_REVISION)) {
            throw new BadRequestException("Cannot return attempt for revision from status " + attempt.getStatus());
        }
        String note = request == null || request.note() == null ? "" : request.note().trim();
        if (note.isEmpty()) {
            throw new BadRequestException("Revision note is required");
        }
        java.time.Instant now = java.time.Instant.now();
        java.time.Instant newDeadline = request.deadline() != null
                ? request.deadline()
                : now.plus(java.time.Duration.ofHours(24));
        if (!newDeadline.isAfter(now)) {
            throw new BadRequestException("Revision deadline must be in the future");
        }

        attempt.setStatus(ExamAttemptStatus.RETURNED_FOR_REVISION);
        attempt.setRevisionNote(note);
        attempt.setRevisionDeadline(newDeadline);
        attempt.setOfficialDeadlineAt(newDeadline);
        attempt.setDeadlineAt(newDeadline);
        attemptRepository.save(attempt);

        if (notificationService != null && attempt.getStudent() != null && attempt.getStudent().getId() != null) {
            notificationService.createOnce(
                    attempt.getStudent().getId(),
                    "exam.revision.attempt." + attempt.getId() + "." + newDeadline.getEpochSecond(),
                    "Exam returned for revision",
                    "Your submission for \"" + attempt.getExam().getTitle() + "\" requires revision: " + note,
                    "/student/exams"
            );
        }

        return getDetail(examId, attemptId);
    }

    public EssayGradingDTO.AiGradingResponse requestAiGrading(Long examId, Long attemptId) {
        return requestAiGrading(examId, attemptId, null);
    }

    @Transactional
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
        if (attempt.getAiGradingState() == AiEssayGradingState.CONFIRMED
                || (attempt.getFinalScore() != null && attempt.getStatus() == ExamAttemptStatus.SUBMITTED)) {
            throw new BadRequestException("Bài làm đã được xác nhận điểm chính thức, AI không thể ghi đè kết quả đã xác nhận.");
        }

        List<AiEssayGradingClient.EssayQuestionPayload> payloads = buildEssayPayloads(examId, attempt, request);

        EssayGradingDTO.AiGradingResponse response = aiClient.requestProposal(payloads);
        persistAiDraftProposals(attempt, response);
        return response;
    }

    public List<AiEssayGradingClient.EssayQuestionPayload> buildEssayPayloads(
            Long examId,
            ExamAttempt attempt,
            EssayGradingDTO.AiGradingRequest request
    ) {
        return attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.ESSAY)
                .sorted(Comparator.comparingInt(ExamAttemptQuestion::getDisplayOrder))
                .map(q -> {
                    ExamQuestionGradingConfig config = effectiveGuideline(examId, q);

                    String refAnswer = (config != null && config.getReferenceAnswer() != null && !config.getReferenceAnswer().isBlank())
                            ? config.getReferenceAnswer().trim() : null;

                    String rubric = formatGradingCriteria(q.getGradingCriteria());
                    if (config != null && config.getRubric() != null && !config.getRubric().isBlank()) {
                        rubric = rubric == null ? config.getRubric().trim()
                                : rubric + "\n\nAdditional teacher guidance:\n" + config.getRubric().trim();
                    }

                    if (refAnswer == null && request != null && request.getQuestions() != null) {
                        EssayGradingDTO.QuestionContext ctx = request.getQuestions().get(q.getSourceQuestionId());
                        if (ctx != null && ctx.getReferenceAnswer() != null && !ctx.getReferenceAnswer().isBlank()) {
                            refAnswer = ctx.getReferenceAnswer().trim();
                        }
                    }
                    if ((config == null || config.getRubric() == null || config.getRubric().isBlank())
                            && request != null && request.getQuestions() != null) {
                        EssayGradingDTO.QuestionContext ctx = request.getQuestions().get(q.getSourceQuestionId());
                        if (ctx != null && ctx.getRubric() != null && !ctx.getRubric().isBlank()) {
                            rubric = rubric == null ? ctx.getRubric().trim()
                                    : rubric + "\n\nAdditional teacher guidance:\n" + ctx.getRubric().trim();
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
    }

    public void persistAiDraftProposals(ExamAttempt attempt, EssayGradingDTO.AiGradingResponse response) {
        if (response == null || response.getProposals() == null || response.getProposals().isEmpty()) {
            return;
        }
        // Bảo vệ tuyệt đối: Không bao giờ ghi đè bài đã CONFIRMED chính thức
        if (attempt.getAiGradingState() == AiEssayGradingState.CONFIRMED
                || (attempt.getFinalScore() != null && attempt.getStatus() == ExamAttemptStatus.SUBMITTED)) {
            return;
        }
        Instant now = Instant.now();
        Map<Long, EssayGradingDTO.AiQuestionProposal> proposalMap = new HashMap<>();
        for (EssayGradingDTO.AiQuestionProposal p : response.getProposals()) {
            if (p != null && p.getQuestionId() != null) {
                proposalMap.put(p.getQuestionId(), p);
            }
        }

        BigDecimal maxScore = ExamScoring.effectiveMax(attempt.getMaxScore());
        BigDecimal totalProposed = BigDecimal.ZERO;
        List<ExamAttemptQuestion> essayQuestions = attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.ESSAY)
                .toList();

        for (ExamAttemptQuestion q : essayQuestions) {
            EssayGradingDTO.AiQuestionProposal prop = proposalMap.get(q.getSourceQuestionId());
            if (prop == null) {
                continue;
            }
            BigDecimal cap = ExamScoring.gradingCap(maxScore, q.getPoints(), attempt.getTotalPoints());
            BigDecimal proposed = prop.getProposedScore();
            if (proposed == null || proposed.signum() < 0 || proposed.compareTo(cap) > 0) {
                throw new BadRequestException("Điểm AI đề xuất không hợp lệ cho câu " + q.getDisplayOrder() + ": " + proposed);
            }
            BigDecimal scaled = proposed.setScale(ExamScoring.STORE_SCALE, java.math.RoundingMode.HALF_UP);
            totalProposed = totalProposed.add(scaled);

            ExamAttemptAnswer answer = findAnswer(attempt, q);
            if (answer == null) {
                answer = new ExamAttemptAnswer();
                answer.setAttempt(attempt);
                answer.setQuestion(q);
                answer.setTextAnswer("");
                attempt.getAnswers().add(answer);
            }
            answer.setAiProposedScore(scaled);
            answer.setAiFeedback(prop.getFeedback());
            answer.setAiReasoning(prop.getReasoning());
            answer.setAiAnalysis(prop.getAnalysis());
            answer.setAiFlagAmbiguous(prop.getFlagAmbiguous());
            answer.setAiFlagReason(prop.getFlagReason());
            answer.setAiGradedAt(now);
            answer.setAiGradingStatus(AiEssayGradingState.AI_COMPLETED.name());
            answer.setAiGradingError(null);
            if (prop.getCriterionScores() != null && !prop.getCriterionScores().isEmpty()) {
                try {
                    answer.setAiCriterionScoresJson(objectMapper.writeValueAsString(prop.getCriterionScores()));
                } catch (Exception ignored) {
                    answer.setAiCriterionScoresJson("[]");
                }
            } else {
                answer.setAiCriterionScoresJson("[]");
            }
        }

        attempt.setAiProposedEssayScore(totalProposed);
        attempt.setAiGradingState(AiEssayGradingState.AI_COMPLETED);
        attempt.setAiGradedAt(now);
        attempt.setAiGradingError(null);
        attemptRepository.save(attempt);
    }

    private String formatGradingCriteria(List<EssayGradingCriterion> criteria) {
        if (criteria == null || criteria.isEmpty()) return null;
        return criteria.stream()
                .map(criterion -> criterion.getName() + " (" + criterion.getWeightPercentage() + "%)"
                        + (criterion.getDescription() == null || criterion.getDescription().isBlank()
                        ? "" : ": " + criterion.getDescription().trim()))
                .collect(java.util.stream.Collectors.joining("\n"));
    }

    public Exam requireExam(Long examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
        checkCanGradeExam(exam);
        return exam;
    }

    public void checkCanGradeExam(Exam exam) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return;
        }
        if (!(auth.getPrincipal() instanceof UserPrincipal principal) || principal.getUser() == null) {
            return;
        }
        User currentUser = principal.getUser();
        boolean isAdmin = currentUser.getRoles() != null && currentUser.getRoles().stream()
                .anyMatch(r -> "ADMIN".equalsIgnoreCase(r.getName()));
        boolean isTeacher = currentUser.getRoles() != null && currentUser.getRoles().stream()
                .anyMatch(r -> "TEACHER".equalsIgnoreCase(r.getName()));
        if (!isAdmin && !isTeacher) {
            throw new AccessDeniedException("Bạn không có quyền truy cập chức năng chấm thi.");
        }
        if (isAdmin) {
            return;
        }
        Long currentUserId = currentUser.getId();
        if (exam.getCreatedBy() == null || Objects.equals(exam.getCreatedBy(), currentUserId)) {
            return;
        }
        if (exam.getCourse() != null && exam.getCourse().getInstructorUser() != null
                && Objects.equals(exam.getCourse().getInstructorUser().getId(), currentUserId)) {
            return;
        }
        // Nếu người tạo là một giáo viên khác (không phải ADMIN demo seed), chặn quyền truy cập
        if (userRepository != null) {
            User creator = userRepository.findById(exam.getCreatedBy()).orElse(null);
            if (creator != null && creator.getRoles() != null) {
                boolean creatorIsAdmin = creator.getRoles().stream()
                        .anyMatch(r -> "ADMIN".equalsIgnoreCase(r.getName()));
                if (creatorIsAdmin) {
                    return;
                }
            }
        }
        throw new AccessDeniedException("Bạn không có quyền chấm hoặc xác nhận bài thi của giáo viên khác.");
    }

    public Long currentUserIdOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal && principal.getUser() != null) {
            return principal.getUser().getId();
        }
        return null;
    }

    public EssayGradingDTO.Summary toSummary(ExamAttempt attempt) {
        EssayGradingDTO.Summary summary = new EssayGradingDTO.Summary();
        summary.setAttemptId(attempt.getId());
        if (attempt.getExam() != null) {
            summary.setExamId(attempt.getExam().getId());
            summary.setExamTitle(attempt.getExam().getTitle());
        }
        fillStudent(attempt.getStudent(), summary::setStudentId, summary::setStudentName, summary::setStudentEmail);
        summary.setAttemptNumber(attempt.getAttemptNumber());
        summary.setStatus(attempt.getStatus());
        summary.setSubmittedAt(attempt.getSubmittedAt());
        summary.setFinalScore(attempt.getFinalScore());
        List<ExamAttemptQuestion> essays = attempt.getQuestions().stream()
                .filter(question -> question.getType() == QuestionType.ESSAY)
                .toList();
        summary.setEssayCount(essays.size());
        summary.setEssayAnswered((int) essays.stream()
                .filter(question -> !answerText(attempt, question).isBlank())
                .count());
        summary.setAiGradedEssayCount((int) essays.stream()
                .filter(question -> {
                    ExamAttemptAnswer ans = findAnswer(attempt, question);
                    return ans != null && ans.getAiProposedScore() != null;
                })
                .count());
        List<ExamAttemptQuestion> codings = attempt.getQuestions().stream()
                .filter(question -> question.getType() == QuestionType.CODING)
                .toList();
        summary.setCodingCount(codings.size());
        summary.setCodingAnswered((int) codings.stream()
                .filter(question -> !answerText(attempt, question).isBlank())
                .count());
        summary.setAiGradingState(resolveAiGradingState(attempt));
        summary.setAiProposedScore(resolveAiProposedEssayScore(attempt));
        summary.setAiGradedAt(attempt.getAiGradedAt());
        summary.setAiGradingError(attempt.getAiGradingError());
        summary.setConfirmedBy(attempt.getConfirmedBy());
        summary.setConfirmedAt(attempt.getConfirmedAt());
        summary.setMaxEssayScore(computeMaxEssayScore(attempt));
        summary.setLowScoreFlagged(isLowScoreOrFailFlagged(attempt));
        summary.setLowScoreReason(resolveLowScoreReason(attempt));
        return summary;
    }

    /**
     * Tinh tong diem toi da cua tat ca cac cau hoi tu luan trong luot lam bai.
     */
    public BigDecimal computeMaxEssayScore(ExamAttempt attempt) {
        if (attempt == null || attempt.getQuestions() == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal maxScore = ExamScoring.effectiveMax(attempt.getMaxScore());
        return attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.ESSAY)
                .map(q -> ExamScoring.gradingCap(maxScore, q.getPoints(), attempt.getTotalPoints()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Kiem tra bai thi co bi flag diem qua thap (< 50% diem tu luan hoac duoi diem dat / 0 diem) hay khong.
     * Nhung bai bi flag nay hoac FAILED khong duoc phep xac nhan hang loat ma bat buoc giao vien kiem tra tay.
     */
    public boolean isLowScoreOrFailFlagged(ExamAttempt attempt) {
        return resolveLowScoreReason(attempt) != null;
    }

    public String resolveLowScoreReason(ExamAttempt attempt) {
        if (attempt == null) {
            return null;
        }
        String state = resolveAiGradingState(attempt);
        if (AiEssayGradingState.FAILED.name().equals(state)) {
            return "Chấm AI lỗi — bắt buộc giáo viên kiểm tra và chấm trực tiếp.";
        }
        BigDecimal aiScore = resolveAiProposedEssayScore(attempt);
        if (aiScore == null) {
            return null;
        }
        BigDecimal maxEssay = computeMaxEssayScore(attempt);
        if (aiScore.signum() <= 0) {
            return "Điểm AI đề xuất = 0đ (Fail) — bắt buộc giáo viên kiểm tra trực tiếp.";
        }
        if (maxEssay.signum() > 0) {
            BigDecimal halfMaxEssay = maxEssay.multiply(new BigDecimal("0.50"));
            if (aiScore.compareTo(halfMaxEssay) < 0) {
                return String.format(
                        "Điểm tự luận quá thấp (%s / %s đ < 50%%) — bắt buộc giáo viên kiểm tra trực tiếp.",
                        aiScore.stripTrailingZeros().toPlainString(),
                        maxEssay.stripTrailingZeros().toPlainString()
                );
            }
        }
        BigDecimal objective = attempt.getObjectiveScore() != null ? attempt.getObjectiveScore() : BigDecimal.ZERO;
        BigDecimal projectedTotal = ExamScoring.clamp(
                ExamScoring.applyPenalty(objective.add(aiScore), attempt.getLatePenaltyPercentApplied()),
                ExamScoring.effectiveMax(attempt.getMaxScore())
        );
        BigDecimal passScore = ExamScoring.effectivePassScore(attempt);
        if (passScore != null && passScore.signum() > 0 && projectedTotal.compareTo(passScore) < 0) {
            return String.format(
                    "Tổng điểm dự kiến (%s đ) dưới mức điểm đạt (%s đ - Fail) — bắt buộc giáo viên kiểm tra trực tiếp.",
                    projectedTotal.stripTrailingZeros().toPlainString(),
                    passScore.stripTrailingZeros().toPlainString()
            );
        }
        return null;
    }

    /**
     * Luu hoac tu dong sinh tieu chi cham & cau tra loi mau cho cac cau hoi tu luan cua ky thi
     * khi giao vien khoi chay Batch AI Grading.
     */
    @Transactional
    public void applyOrAutoGenerateExamGuidelines(
            Long examId,
            String customReferenceAnswer,
            String customRubric,
            boolean autoGenerateIfBlank
    ) {
        String trimmedRef = customReferenceAnswer != null ? customReferenceAnswer.trim() : "";
        String trimmedRubric = customRubric != null ? customRubric.trim() : "";
        List<ExamAttempt> attempts = attemptRepository.findAllByExam_Id(examId);

        Map<Long, ExamAttemptQuestion> essayQuestionsById = new LinkedHashMap<>();
        for (ExamAttempt att : attempts) {
            if (att.getQuestions() == null) continue;
            for (ExamAttemptQuestion q : att.getQuestions()) {
                if (q.getType() == QuestionType.ESSAY && q.getSourceQuestionId() != null) {
                    essayQuestionsById.putIfAbsent(q.getSourceQuestionId(), q);
                }
            }
        }

        Instant now = Instant.now();
        for (Map.Entry<Long, ExamAttemptQuestion> entry : essayQuestionsById.entrySet()) {
            Long qId = entry.getKey();
            ExamAttemptQuestion sampleQ = entry.getValue();
            ExamQuestionGradingConfig config = gradingConfigRepository
                    .findByExamIdAndQuestionId(examId, qId)
                    .orElseGet(() -> ExamQuestionGradingConfig.builder()
                            .examId(examId)
                            .questionId(qId)
                            .build());

            boolean changed = false;
            if (!trimmedRef.isEmpty()) {
                config.setReferenceAnswer(trimmedRef);
                config.setReferenceSubmittedAt(now);
                changed = true;
            } else if (autoGenerateIfBlank && (config.getReferenceAnswer() == null || config.getReferenceAnswer().isBlank())) {
                String qContent = sampleQ.getContent() != null ? sampleQ.getContent().trim() : "Câu hỏi tự luận #" + sampleQ.getDisplayOrder();
                config.setReferenceAnswer(
                        "[AI Tự động thiết lập đáp án mẫu chuẩn từ đề bài]: Trình bày đầy đủ khái niệm cốt lõi, giải thích rõ nguyên lý hoạt động, phân tích đúng các bước giải quyết vấn đề và nêu ví dụ minh họa thực tế bám sát yêu cầu đề bài: \"" + qContent + "\"."
                );
                config.setReferenceSubmittedAt(now);
                changed = true;
            }

            if (!trimmedRubric.isEmpty()) {
                config.setRubric(trimmedRubric);
                config.setRubricSubmittedAt(now);
                changed = true;
            } else if (autoGenerateIfBlank && (config.getRubric() == null || config.getRubric().isBlank())) {
                String existingCriteria = formatGradingCriteria(sampleQ.getGradingCriteria());
                if (existingCriteria != null && !existingCriteria.isBlank()) {
                    config.setRubric(existingCriteria);
                } else {
                    config.setRubric(
                            "1. Độ chính xác học thuật & nắm vững kiến thức trọng tâm (40%)\n" +
                            "2. Lập luận logic, phân tích đầy đủ các ý theo yêu cầu đề bài (40%)\n" +
                            "3. Ví dụ minh họa rõ ràng, trình bày mạch lạc & thuật ngữ chuẩn xác (20%)"
                    );
                }
                config.setRubricSubmittedAt(now);
                changed = true;
            }

            if (changed) {
                gradingConfigRepository.save(config);
            }
        }
    }

    /**
     * Xac nhan diem chinh thuc cho 1 bai thi tu ket qua AI da cham nhap (dung trong Bulk Confirm).
     */
    @Transactional
    public void confirmAiDraftAsOfficialGrade(Long examId, ExamAttempt attempt) {
        if (attempt == null) return;
        String state = resolveAiGradingState(attempt);
        if (!AiEssayGradingState.AI_COMPLETED.name().equals(state)) {
            throw new BadRequestException("Bài thi #" + attempt.getId() + " chưa có kết quả chấm nháp AI hoàn tất.");
        }
        if (isLowScoreOrFailFlagged(attempt)) {
            throw new BadRequestException("Bài thi #" + attempt.getId() + " bị gắn cờ điểm thấp/Fail, bắt buộc giáo viên kiểm tra và xác nhận thủ công.");
        }
        List<ExamAttemptQuestion> essayQuestions = attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.ESSAY)
                .toList();
        List<EssayGradingDTO.QuestionGrade> grades = new ArrayList<>();
        for (ExamAttemptQuestion q : essayQuestions) {
            ExamAttemptAnswer ans = findAnswer(attempt, q);
            if (ans == null || ans.getAiProposedScore() == null) {
                throw new BadRequestException("Bài thi #" + attempt.getId() + " thiếu điểm AI đề xuất ở câu hỏi " + q.getDisplayOrder());
            }
            EssayGradingDTO.QuestionGrade g = new EssayGradingDTO.QuestionGrade();
            g.setQuestionId(q.getSourceQuestionId());
            g.setScore(ans.getAiProposedScore());
            g.setFeedback(ans.getAiFeedback() != null ? ans.getAiFeedback() : "");
            grades.add(g);
        }
        EssayGradingDTO.GradeSubmissionRequest req = new EssayGradingDTO.GradeSubmissionRequest();
        req.setGrades(grades);
        req.setConfirmOverwrite(false);
        submitOfficialGrade(examId, attempt.getId(), req);
    }

    public String resolveAiGradingState(ExamAttempt attempt) {
        if (attempt.getAiGradingState() != null) {
            return attempt.getAiGradingState().name();
        }
        if (attempt.getFinalScore() != null && attempt.getStatus() == ExamAttemptStatus.SUBMITTED) {
            return AiEssayGradingState.CONFIRMED.name();
        }
        boolean hasAiDraft = attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.ESSAY)
                .anyMatch(q -> {
                    ExamAttemptAnswer ans = findAnswer(attempt, q);
                    return ans != null && ans.getAiProposedScore() != null;
                });
        if (hasAiDraft) {
            return AiEssayGradingState.AI_COMPLETED.name();
        }
        return null;
    }

    public BigDecimal resolveAiProposedEssayScore(ExamAttempt attempt) {
        if (attempt.getAiProposedEssayScore() != null) {
            return attempt.getAiProposedEssayScore();
        }
        List<ExamAttemptQuestion> essays = attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.ESSAY)
                .toList();
        boolean anyAi = false;
        BigDecimal sum = BigDecimal.ZERO;
        for (ExamAttemptQuestion q : essays) {
            ExamAttemptAnswer ans = findAnswer(attempt, q);
            if (ans != null && ans.getAiProposedScore() != null) {
                anyAi = true;
                sum = sum.add(ans.getAiProposedScore());
            }
        }
        return anyAi ? sum : null;
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
        applyAi(item::setAiPercent, item::setAiLevel, item::setAiSignals, answer, true);
        if (answer != null) {
            item.setScore(answer.getScore());
            item.setFeedback(answer.getFeedback());
            List<String> stored = CodingScoring.statuses(answer.getCodeResult());
            if (!stored.isEmpty()) item.setTestStatuses(stored);
            if (answer.getScore() == null) {
                item.setAutoGradeState(answer.getGradeAttempts() >= CodingGradingService.MAX_AUTO_ATTEMPTS
                        ? "FAILED"
                        : (answer.getGradeAttempts() > 0 ? "RETRYING" : "PENDING"));
            }
        }
        return item;
    }

    /**
     * Chup Reference / Rubric hien hanh vao tung cau tu luan cua luot lam, chi lan cham dau tien.
     * Sau do sua rubric chi anh huong cac bai chua cham; bai da cham giu nguyen ban da chup.
     */
    private void freezeGuidelines(Long examId, ExamAttempt attempt) {
        Instant now = Instant.now();
        for (ExamAttemptQuestion q : attempt.getQuestions()) {
            if (q.getType() != QuestionType.ESSAY || q.getGuidelineSnapshotAt() != null) {
                continue;
            }
            ExamQuestionGradingConfig live = gradingConfigRepository
                    .findByExamIdAndQuestionId(examId, q.getSourceQuestionId())
                    .orElse(null);
            if (live != null) {
                q.setGuidelineReference(live.getReferenceAnswer());
                q.setGuidelineReferenceAt(live.getReferenceSubmittedAt());
                q.setGuidelineRubric(live.getRubric());
                q.setGuidelineRubricAt(live.getRubricSubmittedAt());
            }
            q.setGuidelineSnapshotAt(now);
        }
    }

    public List<ExamQuestionGradingConfig> findExamGradingConfigs(Long examId) {
        if (gradingConfigRepository == null) {
            return List.of();
        }
        List<ExamQuestionGradingConfig> list = gradingConfigRepository.findByExamId(examId);
        return list != null ? list : List.of();
    }

    /** Reference / Rubric dung de cham cau nay: ban da chup neu co, nguoc lai ban dang luu (chua cham). */
    private ExamQuestionGradingConfig effectiveGuideline(Long examId, ExamAttemptQuestion q) {
        if (q.getGuidelineSnapshotAt() != null) {
            return ExamQuestionGradingConfig.builder()
                    .examId(examId)
                    .questionId(q.getSourceQuestionId())
                    .referenceAnswer(q.getGuidelineReference())
                    .referenceSubmittedAt(q.getGuidelineReferenceAt())
                    .rubric(q.getGuidelineRubric())
                    .rubricSubmittedAt(q.getGuidelineRubricAt())
                    .build();
        }
        return gradingConfigRepository
                .findByExamIdAndQuestionId(examId, q.getSourceQuestionId())
                .orElse(null);
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

        ExamQuestionGradingConfig config = effectiveGuideline(attempt.getExam().getId(), question);
        item.setGuidelineFrozen(question.getGuidelineSnapshotAt() != null);
        item.setGuidelineSnapshotAt(question.getGuidelineSnapshotAt());
        if (config != null) {
            item.setReferenceAnswer(config.getReferenceAnswer());
            item.setReferenceSubmittedAt(config.getReferenceSubmittedAt());
            item.setRubric(config.getRubric());
            item.setRubricSubmittedAt(config.getRubricSubmittedAt());
        }

        ExamAttemptAnswer answer = findAnswer(attempt, question);
        applyAi(item::setAiPercent, item::setAiLevel, item::setAiSignals, answer, false);
        if (answer != null) {
            item.setScore(answer.getScore());
            item.setFeedback(answer.getFeedback());
            item.setAiGradedAt(answer.getAiGradedAt());
            item.setAiGradingStatus(answer.getAiGradingStatus());
            item.setAiGradingError(answer.getAiGradingError());
            if (answer.getAiProposedScore() != null) {
                EssayGradingDTO.AiQuestionProposal proposal = new EssayGradingDTO.AiQuestionProposal();
                proposal.setQuestionId(question.getSourceQuestionId());
                proposal.setProposedScore(answer.getAiProposedScore());
                proposal.setFeedback(answer.getAiFeedback() != null ? answer.getAiFeedback() : "");
                proposal.setReasoning(answer.getAiReasoning() != null ? answer.getAiReasoning() : "");
                proposal.setAnalysis(answer.getAiAnalysis() != null ? answer.getAiAnalysis() : "");
                proposal.setFlagAmbiguous(answer.getAiFlagAmbiguous());
                proposal.setFlagReason(answer.getAiFlagReason());
                if (answer.getAiCriterionScoresJson() != null && !answer.getAiCriterionScoresJson().isBlank()) {
                    try {
                        proposal.setCriterionScores(objectMapper.readValue(
                                answer.getAiCriterionScoresJson(),
                                new TypeReference<List<EssayGradingDTO.CriterionScore>>() {}
                        ));
                    } catch (Exception ignored) {
                        proposal.setCriterionScores(List.of());
                    }
                } else {
                    proposal.setCriterionScores(List.of());
                }
                item.setAiProposal(proposal);
            }
        }

        return item;
    }

    /** Stored AI estimate; falls back to computing it for answers submitted before this feature existed. */
    private void applyAi(java.util.function.Consumer<Integer> pct, java.util.function.Consumer<String> level,
                         java.util.function.Consumer<List<String>> signals, ExamAttemptAnswer answer, boolean code) {
        if (answer == null) return;
        Integer p = answer.getAiPercent();
        List<String> sig = null;
        if (p != null && answer.getAiSignals() != null) {
            sig = List.of(answer.getAiSignals().split(" \\| "));
        } else if (p == null) {
            var r = com.example.starter_project_2025.system.exam.integrity.ai.AiContentDetector
                    .analyze(answer.getTextAnswer(), code);
            if (r != null) { p = r.percent(); sig = r.signals(); }
        }
        if (p == null) return;
        pct.accept(p);
        level.accept(p >= com.example.starter_project_2025.system.exam.integrity.ai.AiContentDetector.HIGH ? "HIGH"
                : p >= com.example.starter_project_2025.system.exam.integrity.ai.AiContentDetector.MEDIUM ? "MEDIUM" : "LOW");
        signals.accept(sig);
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
