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
import com.example.starter_project_2025.system.exam.attempt.dto.ExamPreparationDTO;
import com.example.starter_project_2025.system.exam.attempt.dto.LearnerExamDTO;
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
import com.example.starter_project_2025.system.exam.core.domain.ExamStatus;
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

@Service
@RequiredArgsConstructor
@Transactional
public class ExamAttemptService {

    final ExamRepository examRepository;
    final ExamAttemptRepository attemptRepository;
    final UserRepository userRepository;
    final QuestionTakerMapper questionTakerMapper;
    final InvitationRepository invitationRepository;
    final ExamResultAccessService resultAccessService;
    final ExamProctorImageRepository proctorImageRepository;
    final ExamProgressLockService progressLockService;
    final ExamQuestionPoolVersionRepository poolVersionRepository;
    final ExamPoolRandomSelectionService randomSelectionService;
    final ExamPoolAttemptSnapshotService poolAttemptSnapshotService;
    final ExamAttemptQuestionFlow examAttemptQuestionFlow = new ExamAttemptQuestionFlow(this);
    final ExamAttemptGradingFlow examAttemptGradingFlow = new ExamAttemptGradingFlow(this);
    final ExamAttemptMappingFlow examAttemptMappingFlow = new ExamAttemptMappingFlow(this);
    final ExamAttemptReviewFlow examAttemptReviewFlow = new ExamAttemptReviewFlow(this);

    /** No attempts are created, expired, graded or saved while reading this overview. */
    @Transactional(readOnly = true)
    public ExamPreparationDTO preparation(Long examId, Long studentId) {
        Exam exam = examRepository.findById(examId)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Assessment is unavailable"));
        List<ExamAttempt> attempts = attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(examId, studentId);
        // Prior takers retain access to their own metadata, matching existing resume/review behavior.
        if (attempts.isEmpty()) progressLockService.assertCanViewAssessment(exam, studentId);
        ExamAttempt active = attempts.stream().filter(a -> a.getStatus() == ExamAttemptStatus.IN_PROGRESS)
                .max(Comparator.comparingInt(ExamAttempt::getAttemptNumber)).orElse(null);
        int remaining = Math.max(0, maxAttempts(exam) - attempts.size());
        String reason = null;
        int count = 0;
        if (active == null) {
            try {
                ExamQuestionPoolVersion pool = poolVersionRepository.findTopByExam_IdOrderByVersionNumberDesc(examId).orElse(null);
                if (pool == null) {
                    var questions = examAttemptQuestionFlow.activeQuestions(exam);
                    count = questions.size();
                    if (count == 0 || questions.stream().mapToInt(Question::getPoints).sum() <= 0)
                        reason = "This assessment has no valid questions yet.";
                } else {
                    // Uses the same snapshot validation as start, without selecting or exposing questions.
                    int available = (int) pool.getQuestions().stream().filter(examAttemptQuestionFlow::isPoolSnapshotStructurallyValid).count();
                    count = Boolean.TRUE.equals(pool.getRandomSelectionEnabled())
                            ? Optional.ofNullable(pool.getRandomQuestionCount()).orElse(0) : available;
                    if (count < 1 || count > available) reason = "This assessment's question pool is unavailable.";
                }
                progressLockService.assertUnlocked(exam, studentId);
                ensureInvitationAccepted(examId, studentId);
                if (remaining == 0) reason = "You have used all available attempts.";
            } catch (AccessDeniedException | BadRequestException blocked) {
                reason = blocked.getMessage();
            }
        } else {
            count = active.getQuestions().size();
            if (isExpired(active, Instant.now())) reason = "The active attempt's deadline has passed. Open it to finalize the expired attempt.";
        }
        final int attemptsRemaining = remaining;
        List<ExamPreparationDTO.Attempt> summaries = attempts.stream()
                .sorted(Comparator.comparingInt(ExamAttempt::getAttemptNumber).reversed())
                .map(a -> new ExamPreparationDTO.Attempt(examAttemptMappingFlow.toSummary(a),
                        resultAccessService.canStudentViewOwnSubmission(exam, a.getStatus())
                        || (resultAccessService.canStudentViewScore(exam)
                            && resultAccessService.canStudentViewAnswers(exam, a.getStatus(), attemptsRemaining))))
                .toList();
        return new ExamPreparationDTO(LearnerExamDTO.from(exam), count, exam.getPassScore(), attempts.size(), remaining,
                active == null && reason == null, active != null, reason,
                Boolean.TRUE.equals(exam.getAntiCheatEnabled()), Boolean.TRUE.equals(exam.getRequireFullscreen()),
                Boolean.TRUE.equals(exam.getCameraProctoring()), summaries);
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<LearnerExamDTO> learnerExams(org.springframework.data.domain.Pageable pageable) {
        return examRepository.findAll((org.springframework.data.jpa.domain.Specification<Exam>)
                (exam, query, cb) -> cb.isTrue(exam.get("isActive")), pageable).map(LearnerExamDTO::from);
    }

    /** Loading /take may resume an existing attempt, but can never allocate a new one. */
    public ExamAttemptDTO currentAttempt(Long examId, Long studentId) {
        ExamAttempt attempt = attemptRepository.findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(examId, studentId)
                .stream().max(Comparator.comparingInt(ExamAttempt::getAttemptNumber))
                .orElseThrow(() -> new ResourceNotFoundException("Open the assessment overview to start an attempt"));
        if (!Boolean.TRUE.equals(attempt.getExam().getIsActive()))
            throw new ResourceNotFoundException("Assessment is unavailable");
        if (attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS) expireIfOverdue(attempt.getId(), Instant.now());
        return examAttemptMappingFlow.toResponse(attempt);
    }

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

        List<ExamAttempt> attempts = attemptRepository
                .findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(examId, studentId);
        Optional<ExamAttempt> existing = attempts.stream()
                .filter(candidate -> candidate.getStatus() == ExamAttemptStatus.IN_PROGRESS
                        || candidate.getStatus() == ExamAttemptStatus.RETURNED_FOR_REVISION)
                .max(Comparator.comparingInt(ExamAttempt::getAttemptNumber));
        if (existing.isPresent()) {
            ExamAttempt attempt = existing.get();
            expireIfOverdue(attempt.getId(), Instant.now());
            return examAttemptMappingFlow.toResponse(attempt);
        }

        assertExamOpenForNewAttempt(exam);

        if (!anonymousGuest || progressLockService.requiresCourseEnrollment(exam)) {
            progressLockService.assertUnlocked(exam, studentId);
        }
        if (!anonymousGuest) {
            ensureInvitationAccepted(examId, studentId);
        }
        ensureExamPasswordValid(exam, password);

        int maxAttempts = exam.getMaxAttempts() == null ? 1 : exam.getMaxAttempts();
        if (attempts.size() >= maxAttempts) {
            throw new BadRequestException("Bạn đã sử dụng hết số lần làm bài");
        }
        ExamQuestionPoolVersion poolVersion = poolVersionRepository == null
                ? null
                : poolVersionRepository
                        .findTopByExam_IdOrderByVersionNumberDesc(examId)
                        .orElse(null);

        List<Question> questions = null;
        List<ExamPoolQuestion> selectedPoolQuestions = null;

        if (poolVersion != null) {
            selectedPoolQuestions = examAttemptQuestionFlow.questionsFromPool(poolVersion);

            if (selectedPoolQuestions.isEmpty()) {
                throw new BadRequestException(
                        "Question Pool không có câu hỏi hợp lệ"
                );
            }
        } else {
            questions = examAttemptQuestionFlow.activeQuestions(exam);

            if (questions.isEmpty()) {
                throw new BadRequestException(
                        "Đề thi chưa có câu hỏi hợp lệ"
                );
            }
        }

        int totalPoints = poolVersion != null
                ? selectedPoolQuestions.stream()
                  .mapToInt(ExamPoolQuestion::getPoints)
                  .sum()
                : questions.stream()
                  .mapToInt(Question::getPoints)
                  .sum();

        if (totalPoints <= 0) {
            throw new BadRequestException(
                    "Tổng điểm các câu hỏi phải lớn hơn 0"
            );
        }

        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));
        Instant startedAt = Instant.now();
        ExamAttempt attempt = new ExamAttempt();
        attempt.setExam(exam);
        attempt.setStudent(student);
        attempt.setPoolVersion(poolVersion);
        attempt.setAttemptNumber(attempts.stream()
                .mapToInt(ExamAttempt::getAttemptNumber)
                .max()
                .orElse(0) + 1);
        attempt.setDurationMinutes(exam.getDurationMinutes());
        attempt.setTotalPoints(totalPoints);
        attempt.setMaxScore(ExamScoring.effectiveMax(exam.getMaxScore()));
        attempt.setPassScore(exam.getPassScore());
        attempt.setStartedAt(startedAt);
        Instant durationDeadline = startedAt.plus(Duration.ofMinutes(exam.getDurationMinutes()));
        // Khong con lich thi (gio dong de) nen han nop chi tinh theo thoi luong va khong co thoi gian gia han.
        attempt.setLateGraceEligible(false);
        attempt.setLatePolicy(exam.getLatePolicy());
        attempt.setLatePenaltyPercent(exam.getLatePenaltyPercent());
        attempt.setOfficialDeadlineAt(durationDeadline);
        attempt.setDeadlineAt(durationDeadline);
        attempt.setStatus(ExamAttemptStatus.IN_PROGRESS);
        if (poolVersion != null) {
            List<ExamAttemptQuestion> snapshots =
                    poolAttemptSnapshotService.createSnapshots(
                            attempt,
                            selectedPoolQuestions
                    );

            attempt.getQuestions().addAll(snapshots);
        } else {
            examAttemptQuestionFlow.snapshotQuestions(
                    attempt,
                    exam,
                    questions,
                    Boolean.TRUE.equals(exam.getShuffleQuestions())
            );
        }
        return examAttemptMappingFlow.toResponse(attemptRepository.save(attempt));
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
                .map(examAttemptMappingFlow::toSummary)
                .toList();
    }

    /** examId -> reason, only for exams this student cannot open yet (lesson/section not completed). */
    @Transactional(readOnly = true)
    public Map<Long, String> findLockedExamReasons(Long studentId) {
        Map<Long, String> result = new HashMap<>();
        progressLockService.lockedExamsForUser(studentId)
                .forEach((examId, state) -> result.put(examId, state.reason()));
        return result;
    }

    @Transactional(readOnly = true)
    public ExamAttemptReviewDTO reviewAttempt(Long attemptId, Long studentId) {
        return examAttemptReviewFlow.reviewAttempt(attemptId, studentId);
    }

    /**
     * Giao vien / admin xem bai lam cua sinh vien de kiem tra khi xu ly khieng nai.
     * Luon hien thi dap an dung/sai vi giao vien can dung de cham.
     */
    @Transactional(readOnly = true)
    public ExamAttemptReviewDTO reviewAttemptForTeacher(Long attemptId) {
        return examAttemptReviewFlow.reviewAttemptForTeacher(attemptId);
    }

    @Transactional(readOnly = true)
    public ExamAttempt findAttemptForReview(Long attemptId) {
        return examAttemptReviewFlow.findAttemptForReview(attemptId);
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
        return examAttemptMappingFlow.toResponse(attempt);
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
                examAttemptGradingFlow.gradeAndSubmit(attempt, now, false);
                attemptRepository.save(attempt);
            }
            case GRADE_AS_EXPIRED -> expire(attempt);
            case RETURN_CURRENT -> { }
        }
        return examAttemptMappingFlow.toResponse(attempt);
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
        examAttemptGradingFlow.gradeAndSubmit(attempt, deadlineOf(attempt), true);
        attemptRepository.save(attempt);
    }

     Instant deadlineOf(ExamAttempt attempt) {
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

     ExamAttemptAnswer findOrCreateAnswer(ExamAttempt attempt, ExamAttemptQuestion question) {
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











    int maxAttempts(Exam exam) {
        return exam.getMaxAttempts() == null ? 1 : exam.getMaxAttempts();
    }

    private void assertExamOpenForNewAttempt(Exam exam) {
        ExamStatus status = exam.getStatus();
        if (status == ExamStatus.DRAFT) {
            throw new BadRequestException("Assessment is still in draft and not published yet");
        }
        if (status == ExamStatus.CLOSED || status == ExamStatus.ARCHIVED) {
            throw new BadRequestException("Assessment is closed and no longer accepts new attempts");
        }
        LocalDateTime now = LocalDateTime.now();
        if (exam.getStartTime() != null && now.isBefore(exam.getStartTime())) {
            throw new BadRequestException("Assessment has not opened yet");
        }
        if (exam.getEndTime() != null && now.isAfter(exam.getEndTime())) {
            throw new BadRequestException("Assessment window has closed");
        }
    }

    private void ensureExamPasswordValid(Exam exam, String password) {
        if (exam.getAccessCode() != null && !exam.getAccessCode().trim().isEmpty()) {
            if (password == null || !exam.getAccessCode().trim().equals(password.trim())) {
                throw new BadRequestException("Mật khẩu đề thi không chính xác");
            }
        }
    }
}