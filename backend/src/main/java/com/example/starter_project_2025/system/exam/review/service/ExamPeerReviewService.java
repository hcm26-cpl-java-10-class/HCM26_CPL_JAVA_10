package com.example.starter_project_2025.system.exam.review.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.review.audit.ExamReviewAuditAction;
import com.example.starter_project_2025.system.exam.review.audit.ExamReviewAuditService;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewAssignment;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewAssignmentRepository;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewItem;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewItemRepository;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewStatus;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewSubmission;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewSubmissionRepository;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewType;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewAssignmentDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewAssignResultDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewCriterionDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewFeedbackDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewFeedbackItemDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewProgressDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewSubmitRequest;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewTargetDTO;
import com.example.starter_project_2025.system.exam.service.ExamResultAccessService;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.question.domain.EssayGradingCriterion;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Workflow tu danh gia / danh gia cheo (UFR-EXM-012) cho module Exam.
 *
 * <p>Pham vi: chi thuoc module Exam. Ket qua cham luu rieng trong
 * {@code exam_review_*}, KHONG gan vao {@code ExamAttempt.finalScore} va KHONG
 * anh huong diem Course.
 */
@Service
@RequiredArgsConstructor
public class ExamPeerReviewService {

    private static final int SCORE_SCALE = 4;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamReviewAssignmentRepository assignmentRepository;
    private final ExamReviewSubmissionRepository submissionRepository;
    private final ExamReviewItemRepository itemRepository;
    private final ExamReviewAuditService auditService;
    private final ExamResultAccessService resultAccessService;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    // ------------------------------------------------------------------
    // Teacher: phan cong reviewer
    // ------------------------------------------------------------------

    /**
     * Phan cong reviewer cho cac bai lam da nop cua mot de thi.
     *
     * <p>Idempotent: chay lai khong tao ban ghi trung.
     */
    @Transactional
    public ExamReviewAssignResultDTO assignReviewers(Long examId, UserPrincipal principal) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
        Long actorId = principal.getUser().getId();

        boolean selfEnabled = Boolean.TRUE.equals(exam.getSelfReviewEnabled());
        boolean peerEnabled = Boolean.TRUE.equals(exam.getPeerReviewEnabled());
        int peerCount = peerReviewCountOrDefault(exam);

        List<ExamAttempt> eligible = eligibleAttempts(examId);
        Set<Long> reviewerPool = new LinkedHashSet<>();
        for (ExamAttempt attempt : eligible) {
            reviewerPool.add(attempt.getStudent().getId());
        }

        Instant now = Instant.now();
        int created = 0;

        for (ExamAttempt attempt : eligible) {
            Long authorId = attempt.getStudent().getId();

            if (selfEnabled) {
                created += createAssignmentIfAbsent(
                        exam, attempt, authorId, ExamReviewType.SELF, actorId, now) ? 1 : 0;
            }

            if (!peerEnabled) {
                continue;
            }

            // Reviewer cho bai nay: uu tien nguoi thi khac da nop bai, chua cham bai nay.
            List<Long> candidates = new ArrayList<>();
            for (Long candidateId : reviewerPool) {
                if (candidateId.equals(authorId)) {
                    continue;
                }
                candidates.add(candidateId);
            }
            // Da gan peer cho bai nay roi -> khong gan them (idempotent).
            int peerAssigned = (int) assignmentRepository
                    .findAllByAttempt_Id(attempt.getId()).stream()
                    .filter(a -> a.getReviewType() == ExamReviewType.PEER)
                    .count();
            if (peerAssigned > 0) {
                continue;
            }

            for (Long candidateId : candidates) {
                if (peerAssigned >= peerCount) {
                    break;
                }
                boolean createdOne = createAssignmentIfAbsent(
                        exam, attempt, candidateId, ExamReviewType.PEER, actorId, now);
                if (createdOne) {
                    peerAssigned++;
                    created++;
                }
            }
        }

        auditService.record(examId, null, null, ExamReviewAuditAction.ASSIGN, actorId,
                null, Map.of(
                        "created", created,
                        "selfReviewEnabled", selfEnabled,
                        "peerReviewEnabled", peerEnabled,
                        "peerReviewCount", peerCount));

        return buildAssignResult(exam, eligible);
    }

    private boolean createAssignmentIfAbsent(Exam exam,
                                             ExamAttempt attempt,
                                             Long reviewerId,
                                             ExamReviewType type,
                                             Long actorId,
                                             Instant now) {
        if (assignmentRepository.existsByAttempt_IdAndReviewerIdAndReviewType(
                attempt.getId(), reviewerId, type)) {
            return false;
        }
        ExamReviewAssignment assignment = new ExamReviewAssignment();
        assignment.setAttempt(attempt);
        assignment.setExam(exam);
        assignment.setReviewerId(reviewerId);
        assignment.setReviewType(type);
        assignment.setStatus(ExamReviewStatus.ASSIGNED);
        assignment.setAnonymous(!Boolean.FALSE.equals(exam.getPeerReviewAnonymous()));
        assignment.setAssignedAt(now);
        assignment.setAssignedBy(actorId);
        ExamReviewAssignment saved = assignmentRepository.save(assignment);

        notifyAssigned(saved, type);
        return true;
    }

    private void notifyAssigned(ExamReviewAssignment assignment, ExamReviewType type) {
        String title = type == ExamReviewType.SELF
                ? "Self review available"
                : "Peer review assigned";
        String message = type == ExamReviewType.SELF
                ? "You can now review your own submission for \"" + examTitle(assignment) + "\"."
                : "You have been assigned to review a submission for \"" + examTitle(assignment) + "\".";
        notificationService.createOnce(
                assignment.getReviewerId(),
                "exam.review.assigned." + assignment.getId(),
                title,
                message,
                "/student/reviews/" + assignment.getId());
    }

    // ------------------------------------------------------------------
    // Reviewer: xem vi cu cham
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ExamReviewAssignmentDTO> listMyAssignments(Long reviewerId) {
        return assignmentRepository.findAllByReviewerIdOrderByAssignedAtDesc(reviewerId).stream()
                .map(this::toAssignmentDTO)
                .toList();
    }

    /**
     * Chi tiet bai lam duoc cham. Chi reviewer chu assignment moi xem duoc.
     */
    @Transactional(readOnly = true)
    public ExamReviewTargetDTO getTarget(Long assignmentId, Long reviewerId) {
        ExamReviewAssignment assignment = requireOwnedAssignment(assignmentId, reviewerId);

        ExamAttempt attempt = assignment.getAttempt();
        Exam exam = assignment.getExam();
        boolean anonymous = Boolean.TRUE.equals(assignment.getAnonymous());

        List<ExamReviewTargetDTO.ExamReviewQuestionDTO> questions = new ArrayList<>();
        for (ExamAttemptQuestion question : attempt.getQuestions()) {
            if (question.getType() != QuestionType.ESSAY) {
                continue;
            }
            String answerText = findAnswerText(attempt, question);
            if (answerText == null || answerText.isBlank()) {
                continue;
            }

            List<ExamReviewCriterionDTO> criteria = reviewCriteria(question);
            BigDecimal maxPoints = BigDecimal.ZERO.setScale(SCORE_SCALE);
            for (ExamReviewCriterionDTO criterion : criteria) {
                maxPoints = maxPoints.add(criterion.maxPoints());
            }

            boolean showReference = Boolean.TRUE.equals(exam.getPeerReviewShowReference());
            questions.add(new ExamReviewTargetDTO.ExamReviewQuestionDTO(
                    question.getId(),
                    question.getSourceQuestionId(),
                    question.getContent(),
                    question.getPoints(),
                    answerText,
                    criteria,
                    maxPoints.setScale(SCORE_SCALE, RoundingMode.HALF_UP),
                    showReference ? question.getGuidelineReference() : null,
                    showReference ? question.getGuidelineRubric() : null));
        }

        return new ExamReviewTargetDTO(
                assignment.getId(),
                exam.getId(),
                exam.getTitle(),
                attempt.getId(),
                attempt.getAttemptNumber(),
                authorLabel(attempt, anonymous),
                anonymous,
                assignment.getStatus(),
                questions.size(),
                questions);
    }

    /**
     * Nop phieu cham. Chi nop 1 lan (409 neu da nop).
     */
    @Transactional
    public ExamReviewFeedbackDTO submitReview(Long assignmentId,
                                              Long reviewerId,
                                              ExamReviewSubmitRequest request) {
        ExamReviewAssignment assignment = requireOwnedAssignment(assignmentId, reviewerId);

        if (assignment.getStatus() == ExamReviewStatus.SUBMITTED) {
            throw new ExamReviewConflictException("This review has already been submitted");
        }

        ExamAttempt attempt = assignment.getAttempt();
        Map<Long, ExamAttemptQuestion> questionById = new LinkedHashMap<>();
        for (ExamAttemptQuestion question : attempt.getQuestions()) {
            questionById.put(question.getId(), question);
        }

        List<ExamReviewItem> items = new ArrayList<>();
        BigDecimal totalMax = BigDecimal.ZERO.setScale(SCORE_SCALE);
        Set<String> seenKeys = new HashSet<>();

        // Tong diem toi da cua toan bo rubric cua bai lam (khong phu thuoc reviewer da cham hay chua).
        BigDecimal rubricMax = BigDecimal.ZERO.setScale(SCORE_SCALE);
        for (ExamAttemptQuestion question : attempt.getQuestions()) {
            if (question.getType() != QuestionType.ESSAY) {
                continue;
            }
            if (findAnswerText(attempt, question) == null || findAnswerText(attempt, question).isBlank()) {
                continue;
            }
            for (ExamReviewCriterionDTO criterion : reviewCriteria(question)) {
                rubricMax = rubricMax.add(criterion.maxPoints());
            }
        }

        if (request != null && request.items() != null) {
            for (ExamReviewSubmitRequest.Item item : request.items()) {
                if (item == null || item.questionId() == null) {
                    throw new ExamReviewValidationException(
                            "items[].questionId", "Question id is required");
                }
                ExamAttemptQuestion question = questionById.get(item.questionId());
                if (question == null || question.getType() != QuestionType.ESSAY) {
                    throw new ExamReviewValidationException(
                            "items[].questionId", "Question is not part of this submission");
                }
                if (item.criterionName() == null || item.criterionName().isBlank()) {
                    throw new ExamReviewValidationException(
                            "items[].criterionName", "Criterion name is required");
                }
                String key = item.questionId() + "|" + item.criterionName();
                if (!seenKeys.add(key)) {
                    throw new ExamReviewValidationException(
                            "items[].criterionName", "Duplicate criterion for the same question");
                }

                BigDecimal maxPoints = criterionMaxPoints(question, item.criterionName());
                if (maxPoints == null) {
                    throw new ExamReviewValidationException(
                            "items[].criterionName",
                            "Criterion '" + item.criterionName() + "' does not exist in the rubric");
                }
                BigDecimal awarded = item.awardedPoints() == null
                        ? BigDecimal.ZERO.setScale(SCORE_SCALE)
                        : item.awardedPoints().setScale(SCORE_SCALE, RoundingMode.HALF_UP);
                if (awarded.signum() < 0 || awarded.compareTo(maxPoints) > 0) {
                    throw new ExamReviewValidationException(
                            "items[].awardedPoints",
                            "Awarded points must be between 0 and "
                                    + maxPoints.stripTrailingZeros().toPlainString());
                }

                EssayGradingCriterion criterion = findCriterion(question, item.criterionName());
                ExamReviewItem entity = new ExamReviewItem();
                entity.setQuestionId(question.getId());
                entity.setSourceQuestionId(question.getSourceQuestionId());
                entity.setCriterionName(item.criterionName().trim());
                entity.setWeightPercentage(criterion != null ? criterion.getWeightPercentage() : 100);
                entity.setMaxPoints(maxPoints);
                entity.setAwardedPoints(awarded);
                entity.setComment(item.comment() == null ? null : item.comment().trim());
                items.add(entity);

                totalMax = totalMax.add(maxPoints);
            }
        }

        BigDecimal overallScore = request != null ? request.overallScore() : null;
        if (overallScore != null) {
            overallScore = overallScore.setScale(SCORE_SCALE, RoundingMode.HALF_UP);
            BigDecimal overallMax = rubricMax.signum() > 0 ? rubricMax : totalMax;
            if (overallScore.signum() < 0
                    || (overallMax.signum() > 0 && overallScore.compareTo(overallMax) > 0)) {
                throw new ExamReviewValidationException(
                        "overallScore",
                        "Overall score must be between 0 and "
                                + overallMax.stripTrailingZeros().toPlainString());
            }
        }

        ExamReviewSubmission submission = new ExamReviewSubmission();
        submission.setAssignment(assignment);
        submission.setOverallScore(overallScore);
        submission.setMaxOverallScore(rubricMax.signum() > 0 ? rubricMax : totalMax);
        submission.setOverallComment(request != null && request.overallComment() != null
                ? request.overallComment().trim() : null);
        submission.setSubmittedAt(Instant.now());
        ExamReviewSubmission saved = submissionRepository.save(submission);

        for (ExamReviewItem item : items) {
            item.setSubmission(saved);
        }
        itemRepository.saveAll(items);

        assignment.setStatus(ExamReviewStatus.SUBMITTED);
        assignment.setSubmittedAt(submission.getSubmittedAt());
        assignmentRepository.save(assignment);

        auditService.record(assignment.getExam().getId(), assignment.getId(), attempt.getId(),
                ExamReviewAuditAction.SUBMIT, reviewerId, null,
                Map.of(
                        "overallScore", overallScore == null ? "" : overallScore.toPlainString(),
                        "maxOverallScore", submission.getMaxOverallScore().toPlainString(),
                        "itemCount", items.size()));

        notifyAuthorReceived(assignment);

        return toFeedbackDTO(saved, assignment, items, true);
    }

    private void notifyAuthorReceived(ExamReviewAssignment assignment) {
        Long authorId = assignment.getAttempt().getStudent().getId();
        String message = "A new review is available for \""
                + examTitle(assignment) + "\".";
        notificationService.createOnce(
                authorId,
                "exam.review.received." + assignment.getId(),
                "New peer review available",
                message,
                "/student/feedback");
    }

    // ------------------------------------------------------------------
    // Author: xem feedback nhan duoc
    // ------------------------------------------------------------------

    /**
     * Feedback nhan duoc cho tat ca bai lam cua chinh minh.
     *
     * <p>Chi tra ve cac bai lam da cong bo ket qua (release policy).
     */
    @Transactional(readOnly = true)
    public List<ExamReviewFeedbackDTO> listAllMyFeedback(Long studentId) {
        List<ExamReviewFeedbackDTO> result = new ArrayList<>();
        for (ExamAttempt attempt : attemptRepository.findAllByStudent_IdOrderByStartedAtDesc(studentId)) {
            if (!resultAccessService.isResultPublished(attempt.getExam())) {
                continue;
            }
            for (ExamReviewFeedbackDTO feedback : feedbackForAttempt(attempt)) {
                result.add(feedback);
            }
        }
        return result;
    }

    /**
     * Feedback nhan duoc cho mot bai lam cua chinh minh.
     *
     * <p>Chi tra ve khi giao vien da cong bo ket qua (release policy).
     */
    @Transactional(readOnly = true)
    public List<ExamReviewFeedbackDTO> listFeedbackForAttempt(Long attemptId, Long studentId) {
        ExamAttempt attempt = attemptRepository.findByIdAndStudent_Id(attemptId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));

        if (!resultAccessService.isResultPublished(attempt.getExam())) {
            throw new ExamReviewForbiddenException(
                    "Feedback is only available after the teacher publishes the results");
        }

        return feedbackForAttempt(attempt);
    }

    private List<ExamReviewFeedbackDTO> feedbackForAttempt(ExamAttempt attempt) {
        List<ExamReviewFeedbackDTO> result = new ArrayList<>();
        List<ExamReviewAssignment> assignments = assignmentRepository.findAllByAttempt_Id(attempt.getId());
        for (ExamReviewAssignment assignment : assignments) {
            if (assignment.getStatus() != ExamReviewStatus.SUBMITTED) {
                continue;
            }
            Optional<ExamReviewSubmission> submission = submissionRepository.findByAssignment_Id(assignment.getId());
            if (submission.isEmpty()) {
                continue;
            }
            List<ExamReviewItem> items = itemRepository.findAllBySubmission_Id(submission.get().getId());
            result.add(toFeedbackDTO(submission.get(), assignment, items, false));
        }
        return result;
    }

    // ------------------------------------------------------------------
    // Teacher: tien do
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ExamReviewProgressDTO> listProgress(Long examId) {
        List<ExamReviewProgressDTO> rows = new ArrayList<>();
        for (ExamReviewAssignment assignment : assignmentRepository.findAllByExam_Id(examId)) {
            ExamAttempt attempt = assignment.getAttempt();
            rows.add(new ExamReviewProgressDTO(
                    assignment.getId(),
                    attempt.getId(),
                    attempt.getAttemptNumber(),
                    attempt.getStudent() != null ? attempt.getStudent().getFullName() : null,
                    assignment.getReviewType(),
                    assignment.getStatus(),
                    userRepository.findById(assignment.getReviewerId())
                            .map(User::getFullName)
                            .orElse(null),
                    assignment.getAssignedAt(),
                    assignment.getSubmittedAt()));
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public ExamReviewAssignResultDTO getAssignOverview(Long examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
        return buildAssignResult(exam, eligibleAttempts(examId));
    }

    private ExamReviewAssignResultDTO buildAssignResult(Exam exam, List<ExamAttempt> eligible) {
        List<ExamReviewAssignment> all = assignmentRepository.findAllByExam_Id(exam.getId());
        int submitted = (int) all.stream()
                .filter(a -> a.getStatus() == ExamReviewStatus.SUBMITTED)
                .count();
        int pending = all.size() - submitted;

        int peerTarget = Boolean.TRUE.equals(exam.getPeerReviewEnabled())
                ? peerReviewCountOrDefault(exam) : 0;
        int underAssigned = 0;
        if (peerTarget > 0) {
            for (ExamAttempt attempt : eligible) {
                long peerCount = all.stream()
                        .filter(a -> a.getAttempt().getId().equals(attempt.getId()))
                        .filter(a -> a.getReviewType() == ExamReviewType.PEER)
                        .count();
                if (peerCount < peerTarget) {
                    underAssigned++;
                }
            }
        }

        return new ExamReviewAssignResultDTO(
                exam.getId(),
                Boolean.TRUE.equals(exam.getSelfReviewEnabled()),
                Boolean.TRUE.equals(exam.getPeerReviewEnabled()),
                peerReviewCountOrDefault(exam),
                eligible.size(),
                all.size(),
                submitted,
                pending,
                underAssigned);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private List<ExamAttempt> eligibleAttempts(Long examId) {
        List<ExamAttempt> attempts = attemptRepository.findAllByExam_Id(examId);
        List<ExamAttempt> eligible = new ArrayList<>();
        for (ExamAttempt attempt : attempts) {
            ExamAttemptStatus status = attempt.getStatus();
            if (status == ExamAttemptStatus.SUBMITTED
                    || status == ExamAttemptStatus.PENDING_REVIEW
                    || status == ExamAttemptStatus.EXPIRED) {
                eligible.add(attempt);
            }
        }
        eligible.sort((a, b) -> Long.compare(a.getId(), b.getId()));
        return eligible;
    }

    private ExamReviewAssignment requireOwnedAssignment(Long assignmentId, Long reviewerId) {
        ExamReviewAssignment assignment = assignmentRepository.findByIdAndReviewerId(assignmentId, reviewerId)
                .orElseThrow(() -> new ResourceNotFoundException("Review assignment not found"));
        return assignment;
    }

    private ExamReviewAssignmentDTO toAssignmentDTO(ExamReviewAssignment assignment) {
        ExamAttempt attempt = assignment.getAttempt();
        Exam exam = assignment.getExam();
        boolean anonymous = Boolean.TRUE.equals(assignment.getAnonymous());
        return new ExamReviewAssignmentDTO(
                assignment.getId(),
                exam.getId(),
                exam.getTitle(),
                attempt.getId(),
                attempt.getAttemptNumber(),
                assignment.getReviewType(),
                assignment.getStatus(),
                authorLabel(attempt, anonymous),
                anonymous,
                assignment.getAssignedAt(),
                assignment.getDueAt(),
                assignment.getSubmittedAt(),
                countReviewableQuestions(attempt));
    }

    private int countReviewableQuestions(ExamAttempt attempt) {
        int count = 0;
        for (ExamAttemptQuestion question : attempt.getQuestions()) {
            if (question.getType() != QuestionType.ESSAY) {
                continue;
            }
            String answer = findAnswerText(attempt, question);
            if (answer != null && !answer.isBlank()) {
                count++;
            }
        }
        return count;
    }

    private String findAnswerText(ExamAttempt attempt, ExamAttemptQuestion question) {
        for (ExamAttemptAnswer answer : attempt.getAnswers()) {
            if (answer.getQuestion() != null
                    && answer.getQuestion().getId().equals(question.getId())) {
                return answer.getTextAnswer();
            }
        }
        return null;
    }

    /** Nhan hien thi cua tac gia: an danh thi dung nguoi cham, khong an danh thi hien ten that. */
    private String authorLabel(ExamAttempt attempt, boolean anonymous) {
        if (!anonymous) {
            return attempt.getStudent() != null ? attempt.getStudent().getFullName() : "Student";
        }
        return "Anonymous student";
    }

    private String examTitle(ExamReviewAssignment assignment) {
        return assignment.getExam() != null ? assignment.getExam().getTitle() : "";
    }

    private int peerReviewCountOrDefault(Exam exam) {
        Integer count = exam.getPeerReviewCount();
        if (count == null || count < 1) {
            return 2;
        }
        return Math.min(count, 5);
    }

    /** Rubric cua cau hoi (snapshot trong attempt); neu khong co rubric -> mot tieu chi "Overall answer". */
    private List<ExamReviewCriterionDTO> reviewCriteria(ExamAttemptQuestion question) {
        List<ExamReviewCriterionDTO> criteria = new ArrayList<>();
        List<EssayGradingCriterion> sourceCriteria = question.getGradingCriteria();
        if (sourceCriteria != null) {
            for (EssayGradingCriterion criterion : sourceCriteria) {
                criteria.add(new ExamReviewCriterionDTO(
                        criterion.getName(),
                        criterion.getDescription(),
                        criterion.getWeightPercentage(),
                        criterionMax(question.getPoints(), criterion.getWeightPercentage())));
            }
        }
        if (criteria.isEmpty()) {
            criteria.add(new ExamReviewCriterionDTO(
                    "Overall answer",
                    null,
                    100,
                    BigDecimal.valueOf(question.getPoints()).setScale(SCORE_SCALE, RoundingMode.HALF_UP)));
        }
        return criteria;
    }

    private BigDecimal criterionMax(int questionPoints, int weightPercentage) {
        BigDecimal weight = weightPercentage <= 0 ? HUNDRED : BigDecimal.valueOf(weightPercentage);
        return BigDecimal.valueOf(questionPoints)
                .multiply(weight)
                .divide(HUNDRED, SCORE_SCALE, RoundingMode.HALF_UP);
    }

    private BigDecimal criterionMaxPoints(ExamAttemptQuestion question, String criterionName) {
        String wanted = criterionName.trim();
        List<EssayGradingCriterion> criteria = question.getGradingCriteria();
        if (criteria != null) {
            for (EssayGradingCriterion criterion : criteria) {
                if (criterion.getName() != null && criterion.getName().trim().equals(wanted)) {
                    return criterionMax(question.getPoints(), criterion.getWeightPercentage());
                }
            }
        }
        // Fallback: khi bai khong co rubric, reviewer cham theo mot tieu chi "Overall answer".
        if ("Overall answer".equals(wanted)) {
            return BigDecimal.valueOf(question.getPoints()).setScale(SCORE_SCALE, RoundingMode.HALF_UP);
        }
        return null;
    }

    private EssayGradingCriterion findCriterion(ExamAttemptQuestion question, String criterionName) {
        String wanted = criterionName.trim();
        List<EssayGradingCriterion> criteria = question.getGradingCriteria();
        if (criteria == null) {
            return null;
        }
        for (EssayGradingCriterion criterion : criteria) {
            if (criterion.getName() != null && criterion.getName().trim().equals(wanted)) {
                return criterion;
            }
        }
        return null;
    }

    private ExamReviewFeedbackDTO toFeedbackDTO(ExamReviewSubmission submission,
                                                ExamReviewAssignment assignment,
                                                List<ExamReviewItem> items,
                                                boolean reviewerView) {
        ExamAttempt attempt = assignment.getAttempt();
        boolean anonymous = Boolean.TRUE.equals(assignment.getAnonymous());

        String reviewerLabel;
        if (assignment.getReviewType() == ExamReviewType.SELF) {
            reviewerLabel = "Self review";
        } else if (anonymous) {
            reviewerLabel = "Anonymous reviewer";
        } else {
            reviewerLabel = userRepository.findById(assignment.getReviewerId())
                    .map(User::getFullName)
                    .orElse("Reviewer");
        }

        Map<Long, String> questionContent = new LinkedHashMap<>();
        for (ExamAttemptQuestion question : attempt.getQuestions()) {
            questionContent.put(question.getId(), question.getContent());
        }

        List<ExamReviewFeedbackItemDTO> itemDTOs = items.stream()
                .map(item -> new ExamReviewFeedbackItemDTO(
                        item.getQuestionId(),
                        questionContent.get(item.getQuestionId()),
                        item.getCriterionName(),
                        item.getWeightPercentage() == null ? 0 : item.getWeightPercentage(),
                        item.getMaxPoints(),
                        item.getAwardedPoints(),
                        item.getComment()))
                .toList();

        return new ExamReviewFeedbackDTO(
                submission.getId(),
                assignment.getId(),
                assignment.getExam().getId(),
                assignment.getExam().getTitle(),
                attempt.getId(),
                attempt.getAttemptNumber(),
                reviewerLabel,
                anonymous,
                assignment.getReviewType() == ExamReviewType.SELF,
                submission.getOverallScore(),
                submission.getMaxOverallScore(),
                submission.getOverallComment(),
                submission.getSubmittedAt(),
                itemDTOs);
    }
}
