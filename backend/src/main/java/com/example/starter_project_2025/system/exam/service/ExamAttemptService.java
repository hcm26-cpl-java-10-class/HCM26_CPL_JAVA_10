package com.example.starter_project_2025.system.exam.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService;
import com.example.starter_project_2025.system.question.dto.CodeSpecDTO;
import com.example.starter_project_2025.system.question.service.CodeSpecSupport;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptDTO;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptReviewDTO;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptSummaryDTO;
import com.example.starter_project_2025.system.exam.dto.SaveExamAnswerRequest;

import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.domain.EssayGradingCriterion;
import com.example.starter_project_2025.system.question.domain.QuestionOption;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.mapper.QuestionTakerMapper;
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

@Service
@RequiredArgsConstructor
@Transactional
public class ExamAttemptService {

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final UserRepository userRepository;
    private final QuestionTakerMapper questionTakerMapper;
    private final InvitationRepository invitationRepository;
    private final ExamResultAccessService resultAccessService;

    public ExamAttemptDTO startOrResume(Long examId, Long studentId) {
        return startOrResume(examId, studentId, null);
    }

    public ExamAttemptDTO startOrResume(Long examId, Long studentId, String password) {
        return startOrResumeInternal(examId, studentId, password, false);
    }

    public ExamAttemptDTO startOrResumeForGuest(Long examId, Long guestUserId) {
        return startOrResumeForGuest(examId, guestUserId, null);
    }

    public ExamAttemptDTO startOrResumeForGuest(Long examId, Long guestUserId, String password) {
        return startOrResumeInternal(examId, guestUserId, password, true);
    }

    private ExamAttemptDTO startOrResumeInternal(
            Long examId,
            Long studentId,
            String password,
            boolean anonymousGuest
    ) {
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
        if (!anonymousGuest) {
            ensureInvitationAccepted(examId, studentId);
        }
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
        attempt.setMaxScore(ExamScoring.effectiveMax(exam.getMaxScore()));
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

    private void ensureExamWindowOpen(Exam exam, LocalDateTime now) {
        if (exam.getStartTime() != null && now.isBefore(exam.getStartTime())) {
            throw new BadRequestException("Kỳ thi chưa đến giờ mở");
        }
        if (exam.getEndTime() != null && !now.isBefore(exam.getEndTime())) {
            throw new BadRequestException("Kỳ thi đã đóng");
        }
    }

    private void ensureInvitationAccepted(Long examId, Long studentId) {
        List<Invitation> invitations = invitationRepository.findByExamId(examId);
        if (invitations.isEmpty()) {
            return;
        }

        boolean hasAccepted = invitations.stream()
                .anyMatch(invitation -> invitation.getUser() != null
                        && studentId.equals(invitation.getUser().getId())
                        && invitation.getStatus() == InvitationStatus.ACCEPTED);

        if (!hasAccepted) {
            throw new BadRequestException("Bạn cần chấp nhận lời mời trước khi làm bài");
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

    @Transactional(readOnly = true)
    public ExamAttemptReviewDTO reviewAttempt(Long attemptId, Long studentId) {
        ExamAttempt attempt = attemptRepository.findByIdAndStudent_Id(attemptId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        Exam exam = attempt.getExam();
        int attemptsUsed = Math.max(
                attempt.getAttemptNumber(),
                attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(exam.getId(), studentId).size());
        int attemptsRemaining = Math.max(0, maxAttempts(exam) - attemptsUsed);
        if (!resultAccessService.canStudentViewAnswers(exam, attempt.getStatus(), attemptsRemaining)) {
            throw new AccessDeniedException("Chưa thể xem đáp án của bài thi này");
        }

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
        response.setTotalPoints(attempt.getTotalPoints());
        response.setMaxScore(ExamScoring.effectiveMax(attempt.getMaxScore()));
        response.setObjectiveScore(attempt.getObjectiveScore());
        response.setFinalScore(attempt.getFinalScore());
        response.setSubmittedAt(attempt.getSubmittedAt());
        response.setQuestions(attempt.getQuestions().stream()
                .sorted(Comparator.comparingInt(ExamAttemptQuestion::getDisplayOrder))
                .map(question -> toQuestionReview(question, answerByQuestion.get(question.getId()), response.getMaxScore(), attempt.getTotalPoints()))
                .toList());
        return response;
    }

    private ExamAttemptReviewDTO.QuestionReviewDTO toQuestionReview(ExamAttemptQuestion question, ExamAttemptAnswer answer, BigDecimal maxScore, int totalWeight) {
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
                dto.setScore(answer.getScore());
                dto.setFeedback(answer.getFeedback());
            }
            return dto;
        }

        Set<Long> correctIds = question.getOptions().stream()
                .filter(ExamAttemptOption::isCorrect)
                .map(ExamAttemptOption::getSourceOptionId)
                .collect(Collectors.toSet());
        dto.setCorrect(correctIds.equals(selectedIds));
        dto.setOptions(question.getOptions().stream()
                .sorted(Comparator.comparingInt(ExamAttemptOption::getDisplayOrder))
                .map(option -> {
                    ExamAttemptReviewDTO.OptionReviewDTO o = new ExamAttemptReviewDTO.OptionReviewDTO();
                    o.setId(option.getSourceOptionId());
                    o.setContent(option.getContent());
                    o.setImageUrl(option.getImageUrl());
                    o.setCorrect(option.isCorrect());
                    o.setSelected(selectedIds.contains(option.getSourceOptionId()));
                    return o;
                })
                .toList());
        return dto;
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
            if (question.getType() == QuestionType.ESSAY || question.getType() == QuestionType.CODING) {
                if (!selectedIds.isEmpty()) {
                    throw new BadRequestException("Câu hỏi này không nhận lựa chọn trắc nghiệm");
                }
                if (question.getType() == QuestionType.CODING && textAnswer != null
                        && textAnswer.length() > CodeJudgeService.MAX_CODE_LENGTH) {
                    throw new BadRequestException("Code quá dài (tối đa " + CodeJudgeService.MAX_CODE_LENGTH + " ký tự)");
                }
            } else if (textAnswer != null && !textAnswer.isBlank()) {
                throw new BadRequestException("Câu trắc nghiệm không nhận câu trả lời dạng văn bản");
            }

            ExamAttemptAnswer answer = findOrCreateAnswer(attempt, question);
            String previousText = answer.getTextAnswer();
            answer.setSelectedOptions(selectedOptions);
            answer.setTextAnswer(question.getType() == QuestionType.ESSAY || question.getType() == QuestionType.CODING ? textAnswer : null);
            if (question.getType() == QuestionType.ESSAY) {
                String newText = answer.getTextAnswer();
                boolean hasText = newText != null && !newText.isBlank();
                if (Boolean.TRUE.equals(request.getMarkSaved())) {
                    if (!hasText) {
                        throw new BadRequestException("Câu tự luận chưa có nội dung để lưu");
                    }
                    answer.setSaved(true);
                } else if (!java.util.Objects.equals(previousText == null ? "" : previousText,
                        newText == null ? "" : newText)) {
                    answer.setSaved(false);
                }
            } else if (question.getType() == QuestionType.CODING) {
                answer.setSaved(textAnswer != null && !textAnswer.isBlank());
            }
        }
    }

    private Set<ExamAttemptOption> validateAndResolveOptions(ExamAttemptQuestion question, Set<Long> selectedIds) {
        if (question.getType() == QuestionType.ESSAY || question.getType() == QuestionType.CODING) {
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
    }

    private record CodingOutcome(BigDecimal weight, boolean needsReview) {
    }

    /** Cau lap trinh: tinh diem o nen, o day chi danh dau cho cham (hoac 0 diem neu khong nop code). */
    private CodingOutcome gradeCodingQuestion(ExamAttempt attempt, ExamAttemptQuestion question, BigDecimal maxScore) {
        ExamAttemptAnswer answer = findOrCreateAnswer(attempt, question);
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
        response.setMaxScore(ExamScoring.effectiveMax(attempt.getMaxScore()));

        // Diem chi duoc cong bo khi giao vien bam "Publish Results".
        boolean resultPublished = resultAccessService.isResultPublished(attempt.getExam());
        response.setResultPublished(resultPublished);

        if (resultPublished) {
            response.setObjectiveScore(attempt.getObjectiveScore());
            response.setFinalScore(attempt.getFinalScore());
            if (attempt.getStatus() != ExamAttemptStatus.IN_PROGRESS
                    && attempt.getStatus() != ExamAttemptStatus.NOT_STARTED) {
                response.setProvisionalScore(attempt.getFinalScore() != null
                        ? attempt.getFinalScore()
                        : ExamScoring.applyPenalty(attempt.getObjectiveScore(), attempt.getLatePenaltyPercentApplied()));
            }
        }
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
        // NEW (anti-cheat)
        Exam ex = attempt.getExam();
        ExamAttemptDTO.Integrity integrity = new ExamAttemptDTO.Integrity();
        integrity.setEnabled(Boolean.TRUE.equals(ex.getAntiCheatEnabled()));
        integrity.setDetectTabSwitch(integrity.isEnabled() && Boolean.TRUE.equals(ex.getDetectTabSwitch()));
        integrity.setBlockCopyPaste(integrity.isEnabled() && Boolean.TRUE.equals(ex.getBlockCopyPaste()));
        integrity.setRequireFullscreen(integrity.isEnabled() && Boolean.TRUE.equals(ex.getRequireFullscreen()));
        integrity.setSingleSession(integrity.isEnabled() && Boolean.TRUE.equals(ex.getSingleSession()));
        response.setIntegrity(integrity);
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
        response.setSaved(answer.isSaved());
        return response;
    }

    private ExamAttemptSummaryDTO toSummary(ExamAttempt attempt) {
        ExamAttemptSummaryDTO response = new ExamAttemptSummaryDTO();
        response.setId(attempt.getId());
        response.setExamId(attempt.getExam().getId());
        response.setAttemptNumber(attempt.getAttemptNumber());
        response.setStatus(attempt.getStatus());
        response.setTotalPoints(attempt.getTotalPoints());
        response.setMaxScore(ExamScoring.effectiveMax(attempt.getMaxScore()));

        // Diem chi duoc hien thi khi giao vien da cong bo ket qua.
        boolean resultPublished = resultAccessService.isResultPublished(attempt.getExam());
        response.setResultPublished(resultPublished);
        if (resultPublished) {
            response.setObjectiveScore(attempt.getObjectiveScore());
            response.setFinalScore(attempt.getFinalScore());
        }

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

    private void ensureExamPasswordValid(Exam exam, String password) {
        if (exam.getAccessCode() != null && !exam.getAccessCode().trim().isEmpty()) {
            if (password == null || !exam.getAccessCode().trim().equals(password.trim())) {
                throw new BadRequestException("Mật khẩu đề thi không chính xác");
            }
        }
    }
}