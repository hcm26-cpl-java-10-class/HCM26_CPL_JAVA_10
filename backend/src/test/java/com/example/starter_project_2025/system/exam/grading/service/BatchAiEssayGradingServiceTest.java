package com.example.starter_project_2025.system.exam.grading.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.ai.AiEssayGradingClient;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.core.domain.ExamStatus;
import com.example.starter_project_2025.system.exam.grading.domain.AiEssayGradingState;
import com.example.starter_project_2025.system.exam.grading.domain.AiGradingBatchStatus;
import com.example.starter_project_2025.system.exam.grading.domain.ExamAiGradingBatch;
import com.example.starter_project_2025.system.exam.grading.domain.ExamAiGradingBatchItem;
import com.example.starter_project_2025.system.exam.grading.domain.ExamAiGradingBatchItemRepository;
import com.example.starter_project_2025.system.exam.grading.domain.ExamAiGradingBatchRepository;
import com.example.starter_project_2025.system.exam.grading.domain.ExamQuestionGradingConfig;
import com.example.starter_project_2025.system.exam.grading.domain.ExamQuestionGradingConfigRepository;
import com.example.starter_project_2025.system.exam.grading.dto.EssayGradingDTO;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.client.ResourceAccessException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BatchAiEssayGradingServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamAttemptRepository attemptRepository;

    @Mock
    private ExamAiGradingBatchRepository batchRepository;

    @Mock
    private ExamAiGradingBatchItemRepository itemRepository;

    @Mock
    private ExamQuestionGradingConfigRepository gradingConfigRepository;

    @Mock
    private AiEssayGradingClient aiClient;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private PlatformTransactionManager transactionManager;

    private ExamEssayGradingService gradingService;
    private BatchAiEssayGradingService batchService;

    private final Map<Long, Exam> exams = new LinkedHashMap<>();
    private final Map<Long, ExamAttempt> attempts = new LinkedHashMap<>();
    private final Map<Long, ExamAiGradingBatch> batches = new LinkedHashMap<>();
    private final Map<Long, ExamAiGradingBatchItem> batchItems = new LinkedHashMap<>();
    private final Map<String, ExamQuestionGradingConfig> gradingConfigs = new LinkedHashMap<>();
    private final Map<Long, User> users = new LinkedHashMap<>();
    private final Set<String> sentNotificationEventKeys = new HashSet<>();

    private final AtomicLong idGenerator = new AtomicLong(1000L);

    private User teacherOwner;
    private User otherTeacher;
    private User student1;
    private User student2;
    private Exam exam;

    @BeforeEach
    void setUp() {
        exams.clear();
        attempts.clear();
        batches.clear();
        batchItems.clear();
        gradingConfigs.clear();
        users.clear();
        sentNotificationEventKeys.clear();

        lenient().when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        lenient().when(gradingConfigRepository.findByExamIdAndQuestionId(anyLong(), anyLong()))
                .thenAnswer(inv -> Optional.ofNullable(gradingConfigs.get(inv.getArgument(0) + ":" + inv.getArgument(1))));
        lenient().when(gradingConfigRepository.findByExamId(anyLong()))
                .thenAnswer(inv -> {
                    Long exId = inv.getArgument(0);
                    return gradingConfigs.values().stream()
                            .filter(c -> Objects.equals(c.getExamId(), exId))
                            .toList();
                });
        lenient().when(gradingConfigRepository.save(any(ExamQuestionGradingConfig.class)))
                .thenAnswer(inv -> {
                    ExamQuestionGradingConfig cfg = inv.getArgument(0);
                    if (cfg.getId() == null) {
                        cfg.setId(idGenerator.incrementAndGet());
                    }
                    gradingConfigs.put(cfg.getExamId() + ":" + cfg.getQuestionId(), cfg);
                    return cfg;
                });

        gradingService = new ExamEssayGradingService(
                examRepository,
                attemptRepository,
                aiClient,
                null,
                null,
                gradingConfigRepository
        );
        ReflectionTestUtils.setField(gradingService, "userRepository", userRepository);
        ReflectionTestUtils.setField(gradingService, "notificationService", notificationService);

        batchService = new BatchAiEssayGradingService(
                examRepository,
                attemptRepository,
                batchRepository,
                itemRepository,
                gradingService,
                aiClient,
                transactionManager
        );
        ReflectionTestUtils.setField(batchService, "notificationService", notificationService);
        batchService.setRunSynchronously(true);
        batchService.setRetryDelayMs(0L);

        setupRepositoryMocks();

        Role teacherRole = new Role();
        teacherRole.setId(1L);
        teacherRole.setName("TEACHER");
        teacherRole.setIsActive(true);

        Role studentRole = new Role();
        studentRole.setId(2L);
        studentRole.setName("STUDENT");
        studentRole.setIsActive(true);

        teacherOwner = createUser(10L, "teacher.owner@test.local", "Teacher", "Owner", teacherRole);
        otherTeacher = createUser(11L, "teacher.other@test.local", "Teacher", "Other", teacherRole);
        student1 = createUser(20L, "student1@test.local", "Student", "One", studentRole);
        student2 = createUser(21L, "student2@test.local", "Student", "Two", studentRole);

        authenticateAs(teacherOwner);

        exam = new Exam();
        exam.setId(70L);
        exam.setTitle("Midterm Java OOP Assessment");
        exam.setDurationMinutes(60);
        exam.setMaxScore(new BigDecimal("20.00"));
        exam.setPassScore(new BigDecimal("10.00"));
        exam.setMaxAttempts(3);
        exam.setStatus(ExamStatus.PUBLISHED);
        exam.setShowAnswersAfterExam(true);
        exam.setCreatedBy(teacherOwner.getId());
        exams.put(exam.getId(), exam);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        batchService.shutdown();
    }

    private void setupRepositoryMocks() {
        lenient().when(examRepository.findById(anyLong())).thenAnswer(inv -> Optional.ofNullable(exams.get(inv.<Long>getArgument(0))));
        lenient().when(userRepository.findById(anyLong())).thenAnswer(inv -> Optional.ofNullable(users.get(inv.<Long>getArgument(0))));

        lenient().when(attemptRepository.findById(anyLong())).thenAnswer(inv -> Optional.ofNullable(attempts.get(inv.<Long>getArgument(0))));
        lenient().when(attemptRepository.findAllByExam_Id(anyLong())).thenAnswer(inv -> {
            Long exId = inv.getArgument(0);
            return new ArrayList<>(attempts.values().stream()
                    .filter(a -> a.getExam() != null && Objects.equals(a.getExam().getId(), exId))
                    .toList());
        });
        lenient().when(attemptRepository.findFinishedWithAnyQuestionType(anyLong(), anyCollection(), anyCollection()))
                .thenAnswer(inv -> {
                    Long exId = inv.getArgument(0);
                    Collection<ExamAttemptStatus> statuses = inv.getArgument(1);
                    return attempts.values().stream()
                            .filter(a -> a.getExam() != null && Objects.equals(a.getExam().getId(), exId))
                            .filter(a -> statuses.contains(a.getStatus()))
                            .toList();
                });
        lenient().when(attemptRepository.save(any(ExamAttempt.class))).thenAnswer(inv -> {
            ExamAttempt a = inv.getArgument(0);
            if (a.getId() == null) {
                a.setId(idGenerator.incrementAndGet());
            }
            attempts.put(a.getId(), a);
            return a;
        });

        lenient().when(batchRepository.findById(anyLong())).thenAnswer(inv -> Optional.ofNullable(batches.get(inv.<Long>getArgument(0))));
        lenient().when(batchRepository.save(any(ExamAiGradingBatch.class))).thenAnswer(inv -> {
            ExamAiGradingBatch b = inv.getArgument(0);
            if (b.getId() == null) {
                b.setId(idGenerator.incrementAndGet());
            }
            batches.put(b.getId(), b);
            return b;
        });
        lenient().when(batchRepository.findFirstByExamIdAndStatusInOrderByCreatedAtDesc(anyLong(), anyCollection()))
                .thenAnswer(inv -> {
                    Long exId = inv.getArgument(0);
                    Collection<AiGradingBatchStatus> statuses = inv.getArgument(1);
                    return batches.values().stream()
                            .filter(b -> Objects.equals(b.getExamId(), exId) && statuses.contains(b.getStatus()))
                            .findFirst();
                });
        lenient().when(batchRepository.findFirstByExamIdOrderByCreatedAtDesc(anyLong()))
                .thenAnswer(inv -> {
                    Long exId = inv.getArgument(0);
                    List<ExamAiGradingBatch> list = batches.values().stream()
                            .filter(b -> Objects.equals(b.getExamId(), exId))
                            .toList();
                    return list.isEmpty() ? Optional.empty() : Optional.of(list.get(list.size() - 1));
                });
        lenient().when(batchRepository.findByStatusIn(anyCollection())).thenAnswer(inv -> {
            Collection<AiGradingBatchStatus> statuses = inv.getArgument(0);
            return batches.values().stream()
                    .filter(b -> statuses.contains(b.getStatus()))
                    .toList();
        });

        lenient().when(itemRepository.findById(anyLong())).thenAnswer(inv -> Optional.ofNullable(batchItems.get(inv.<Long>getArgument(0))));
        lenient().when(itemRepository.save(any(ExamAiGradingBatchItem.class))).thenAnswer(inv -> {
            ExamAiGradingBatchItem it = inv.getArgument(0);
            if (it.getId() == null) {
                it.setId(idGenerator.incrementAndGet());
            }
            batchItems.put(it.getId(), it);
            return it;
        });
        lenient().when(itemRepository.findByBatch_IdOrderByIdAsc(anyLong())).thenAnswer(inv -> {
            Long bId = inv.getArgument(0);
            return batchItems.values().stream()
                    .filter(it -> it.getBatch() != null && Objects.equals(it.getBatch().getId(), bId))
                    .sorted(Comparator.comparing(ExamAiGradingBatchItem::getId))
                    .toList();
        });
        lenient().when(itemRepository.findByBatch_IdAndStatusInOrderByIdAsc(anyLong(), anyCollection())).thenAnswer(inv -> {
            Long bId = inv.getArgument(0);
            Collection<AiEssayGradingState> statuses = inv.getArgument(1);
            return batchItems.values().stream()
                    .filter(it -> it.getBatch() != null && Objects.equals(it.getBatch().getId(), bId))
                    .filter(it -> statuses.contains(it.getStatus()))
                    .sorted(Comparator.comparing(ExamAiGradingBatchItem::getId))
                    .toList();
        });

        lenient().doAnswer(inv -> {
            Long userId = inv.getArgument(0);
            String eventKey = inv.getArgument(1);
            sentNotificationEventKeys.add(userId + ":" + eventKey);
            return null;
        }).when(notificationService).createOnce(anyLong(), anyString(), anyString(), anyString(), anyString());
    }

    private User createUser(Long id, String email, String firstName, String lastName, Role role) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        u.setUsername(email);
        u.setFirstName(firstName);
        u.setLastName(lastName);
        u.setPasswordHash("hashed");
        u.setIsActive(true);
        u.setRoles(new HashSet<>(Set.of(role)));
        users.put(id, u);
        return u;
    }

    private void authenticateAs(User user) {
        UserPrincipal principal = UserPrincipal.fromUser(user);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private ExamAttempt createEssayAttempt(User student, ExamAttemptStatus status, String answerText) {
        ExamAttempt att = new ExamAttempt();
        att.setId(idGenerator.incrementAndGet());
        att.setExam(exam);
        att.setStudent(student);
        att.setAttemptNumber(1);
        att.setStatus(status);
        att.setStartedAt(Instant.now().minusSeconds(1800));
        if (status != ExamAttemptStatus.IN_PROGRESS && status != ExamAttemptStatus.NOT_STARTED) {
            att.setSubmittedAt(Instant.now().minusSeconds(60));
        }
        att.setTotalPoints(20);
        att.setMaxScore(new BigDecimal("20.00"));
        att.setObjectiveScore(new BigDecimal("10.00"));

        ExamAttemptQuestion q = new ExamAttemptQuestion();
        q.setId(idGenerator.incrementAndGet());
        q.setAttempt(att);
        q.setSourceQuestionId(501L);
        q.setDisplayOrder(1);
        q.setType(QuestionType.ESSAY);
        q.setPoints(10);
        q.setContent("Explain Spring Boot Transaction Management.");
        att.getQuestions().add(q);

        if (answerText != null) {
            ExamAttemptAnswer ans = new ExamAttemptAnswer();
            ans.setId(idGenerator.incrementAndGet());
            ans.setAttempt(att);
            ans.setQuestion(q);
            ans.setTextAnswer(answerText);
            att.getAnswers().add(ans);
        }
        attempts.put(att.getId(), att);
        return att;
    }

    private EssayGradingDTO.AiGradingResponse mockValidAiResponse(Long questionId, BigDecimal score, String feedback) {
        EssayGradingDTO.AiQuestionProposal prop = new EssayGradingDTO.AiQuestionProposal();
        prop.setQuestionId(questionId);
        prop.setProposedScore(score);
        prop.setFeedback(feedback);
        prop.setReasoning("AI reasoning breakdown");
        prop.setAnalysis("AI step analysis");
        prop.setFlagAmbiguous(false);

        EssayGradingDTO.AiGradingResponse resp = new EssayGradingDTO.AiGradingResponse();
        resp.setModel("gemini-2.5-flash");
        resp.setProposals(List.of(prop));
        return resp;
    }

    @Test
    @DisplayName("Scenarios 1 & 3: Batch with multiple valid essay attempts succeeds and stores AI draft without confirming")
    void scenario1And3_batchWithMultipleValidAttemptsSucceedsAsDraft() {
        ExamAttempt att1 = createEssayAttempt(student1, ExamAttemptStatus.PENDING_REVIEW, "Student 1 essay answer on @Transactional");
        ExamAttempt att2 = createEssayAttempt(student2, ExamAttemptStatus.PENDING_REVIEW, "Student 2 essay answer on ACID properties");

        when(aiClient.requestProposal(anyList()))
                .thenReturn(mockValidAiResponse(501L, new BigDecimal("8.50"), "Good explanation S1"))
                .thenReturn(mockValidAiResponse(501L, new BigDecimal("9.00"), "Great explanation S2"));

        EssayGradingDTO.BatchPreviewDTO preview = batchService.previewBatch(exam.getId());
        assertEquals(2, preview.getTotalSubmitted());
        assertEquals(2, preview.getEligibleCount());
        assertEquals(2, preview.getUngradedCount());

        EssayGradingDTO.BatchStatusDTO status = batchService.startBatch(exam.getId(), null);
        assertEquals(AiGradingBatchStatus.COMPLETED.name(), status.getStatus());
        assertEquals(2, status.getTotalAttempts());
        assertEquals(2, status.getCompletedCount());
        assertEquals(0, status.getFailedCount());
        assertEquals(100.0, status.getProgressPercent());

        EssayGradingDTO.Detail detail1 = gradingService.getDetail(exam.getId(), att1.getId());
        assertEquals(AiEssayGradingState.AI_COMPLETED.name(), detail1.getAiGradingState());
        assertNull(detail1.getFinalScore(), "AI must NOT set official finalScore before human confirmation");
        assertNotNull(detail1.getEssays().get(0).getAiProposal());
        assertEquals(0, new BigDecimal("8.50").compareTo(detail1.getEssays().get(0).getAiProposal().getProposedScore()));
        assertNull(detail1.getEssays().get(0).getScore(), "Official question score must remain null until teacher confirms");

        EssayGradingDTO.Detail detail2 = gradingService.getDetail(exam.getId(), att2.getId());
        assertEquals(AiEssayGradingState.AI_COMPLETED.name(), detail2.getAiGradingState());
        assertEquals(0, new BigDecimal("9.00").compareTo(detail2.getEssays().get(0).getAiProposal().getProposedScore()));
    }

    @Test
    @DisplayName("Scenario 2: Batch skips attempt with no essay answer and excludes unsubmitted attempt")
    void scenario2_batchSkipsAttemptWithoutEssayAnswer() {
        ExamAttempt validAtt = createEssayAttempt(student1, ExamAttemptStatus.PENDING_REVIEW, "Valid essay answer");
        ExamAttempt emptyEssayAtt = createEssayAttempt(student2, ExamAttemptStatus.PENDING_REVIEW, "   ");
        createEssayAttempt(student2, ExamAttemptStatus.IN_PROGRESS, "Unsubmitted draft");

        when(aiClient.requestProposal(anyList()))
                .thenReturn(mockValidAiResponse(501L, new BigDecimal("7.00"), "Solid answer"));

        EssayGradingDTO.BatchStatusDTO status = batchService.startBatch(exam.getId(), null);
        assertEquals(AiGradingBatchStatus.COMPLETED.name(), status.getStatus());
        assertEquals(1, status.getCompletedCount());
        assertEquals(1, status.getSkippedCount());

        assertEquals(AiEssayGradingState.AI_COMPLETED.name(), gradingService.getDetail(exam.getId(), validAtt.getId()).getAiGradingState());
        assertEquals(AiEssayGradingState.SKIPPED.name(), gradingService.getDetail(exam.getId(), emptyEssayAtt.getId()).getAiGradingState());
    }

    @Test
    @DisplayName("Scenarios 4 & 5: AI connection error and timeout trigger bounded retry and mark FAILED")
    void scenario4And5_aiConnectionErrorAndTimeoutRetriesAndFails() {
        ExamAttempt att1 = createEssayAttempt(student1, ExamAttemptStatus.PENDING_REVIEW, "Answer for connection test");
        ExamAttempt att2 = createEssayAttempt(student2, ExamAttemptStatus.PENDING_REVIEW, "Answer for timeout test");

        AtomicInteger calls = new AtomicInteger(0);
        when(aiClient.requestProposal(anyList())).thenAnswer(inv -> {
            int c = calls.incrementAndGet();
            if (c <= 3) {
                throw new ResourceAccessException("Connection refused to AI provider");
            }
            throw new BadRequestException("AI provider request timed out after 30s");
        });

        EssayGradingDTO.BatchStatusDTO status = batchService.startBatch(exam.getId(), null);
        assertEquals(AiGradingBatchStatus.FAILED.name(), status.getStatus());
        assertEquals(2, status.getFailedCount());
        assertEquals(0, status.getCompletedCount());
        assertEquals(6, calls.get(), "Must retry MAX_RETRIES=2 times (3 calls per attempt, not infinite)");

        assertEquals(AiEssayGradingState.FAILED.name(), gradingService.getDetail(exam.getId(), att1.getId()).getAiGradingState());
        assertEquals(AiEssayGradingState.FAILED.name(), gradingService.getDetail(exam.getId(), att2.getId()).getAiGradingState());
    }

    @Test
    @DisplayName("Scenario 6: AI returns invalid JSON or out-of-range score -> rejected and marked FAILED")
    void scenario6_aiReturnsInvalidScoreOrMalformedResponseIsRejected() {
        ExamAttempt att1 = createEssayAttempt(student1, ExamAttemptStatus.PENDING_REVIEW, "Answer 1");
        ExamAttempt att2 = createEssayAttempt(student2, ExamAttemptStatus.PENDING_REVIEW, "Answer 2");

        EssayGradingDTO.AiGradingResponse emptyResp = new EssayGradingDTO.AiGradingResponse();
        emptyResp.setProposals(List.of());

        when(aiClient.requestProposal(anyList()))
                .thenReturn(mockValidAiResponse(501L, new BigDecimal("15.00"), "Invalid score > 10"))
                .thenReturn(emptyResp);

        EssayGradingDTO.BatchStatusDTO status = batchService.startBatch(exam.getId(), null);
        assertEquals(AiGradingBatchStatus.FAILED.name(), status.getStatus());
        assertEquals(2, status.getFailedCount());

        EssayGradingDTO.Detail d1 = gradingService.getDetail(exam.getId(), att1.getId());
        assertEquals(AiEssayGradingState.FAILED.name(), d1.getAiGradingState());
        assertNull(d1.getEssays().get(0).getAiProposal(), "Out-of-range AI score must be rejected");

        EssayGradingDTO.Detail d2 = gradingService.getDetail(exam.getId(), att2.getId());
        assertEquals(AiEssayGradingState.FAILED.name(), d2.getAiGradingState());
    }

    @Test
    @DisplayName("Scenario 7: One attempt fails while other attempts in the batch continue and succeed (PARTIAL_FAILED)")
    void scenario7_oneAttemptFailsWhileOthersSucceed() {
        ExamAttempt att1 = createEssayAttempt(student1, ExamAttemptStatus.PENDING_REVIEW, "Answer 1");
        ExamAttempt att2 = createEssayAttempt(student2, ExamAttemptStatus.PENDING_REVIEW, "Answer 2");

        when(aiClient.requestProposal(anyList()))
                .thenThrow(new BadRequestException("Malformed JSON from AI on attempt 1"))
                .thenReturn(mockValidAiResponse(501L, new BigDecimal("9.50"), "Excellent on attempt 2"));

        EssayGradingDTO.BatchStatusDTO status = batchService.startBatch(exam.getId(), null);
        assertEquals(AiGradingBatchStatus.PARTIAL_FAILED.name(), status.getStatus());
        assertEquals(1, status.getCompletedCount());
        assertEquals(1, status.getFailedCount());

        assertEquals(AiEssayGradingState.FAILED.name(), gradingService.getDetail(exam.getId(), att1.getId()).getAiGradingState());
        assertEquals(AiEssayGradingState.AI_COMPLETED.name(), gradingService.getDetail(exam.getId(), att2.getId()).getAiGradingState());
    }

    @Test
    @DisplayName("Scenario 8: Clicking start batch multiple times while active is idempotent and does not duplicate batch")
    void scenario8_idempotentWhenBatchAlreadyActive() {
        createEssayAttempt(student1, ExamAttemptStatus.PENDING_REVIEW, "Answer 1");

        ExamAiGradingBatch existingActive = new ExamAiGradingBatch();
        existingActive.setId(888L);
        existingActive.setExamId(exam.getId());
        existingActive.setExamTitle(exam.getTitle());
        existingActive.setTriggeredByUserId(teacherOwner.getId());
        existingActive.setScope(BatchAiEssayGradingService.SCOPE_UNGRADED_ONLY);
        existingActive.setStatus(AiGradingBatchStatus.PROCESSING);
        existingActive.setTotalAttempts(1);
        existingActive.setProcessingCount(1);
        existingActive.setStartedAt(Instant.now());
        batches.put(existingActive.getId(), existingActive);

        EssayGradingDTO.BatchStatusDTO secondClick = batchService.startBatch(exam.getId(), null);
        assertEquals(888L, secondClick.getBatchId(), "Must return existing active batch instead of creating duplicate");
        verify(aiClient, never()).requestProposal(anyList());
    }

    @Test
    @DisplayName("Scenario 9: Interrupted batch on server restart recovers stuck PROCESSING items and preserves AI_COMPLETED items")
    void scenario9_recoverInterruptedBatchOnServerRestart() {
        ExamAttempt att1 = createEssayAttempt(student1, ExamAttemptStatus.PENDING_REVIEW, "Already AI graded before crash");
        ExamAttempt att2 = createEssayAttempt(student2, ExamAttemptStatus.PENDING_REVIEW, "Was stuck in PROCESSING when server restarted");

        gradingService.persistAiDraftProposals(att1, mockValidAiResponse(501L, new BigDecimal("8.00"), "Preserved AI result"));
        att2.setAiGradingState(AiEssayGradingState.PROCESSING);

        ExamAiGradingBatch interruptedBatch = new ExamAiGradingBatch();
        interruptedBatch.setId(999L);
        interruptedBatch.setExamId(exam.getId());
        interruptedBatch.setExamTitle(exam.getTitle());
        interruptedBatch.setTriggeredByUserId(teacherOwner.getId());
        interruptedBatch.setScope(BatchAiEssayGradingService.SCOPE_UNGRADED_ONLY);
        interruptedBatch.setStatus(AiGradingBatchStatus.PROCESSING);
        interruptedBatch.setTotalAttempts(2);
        interruptedBatch.setCompletedCount(1);
        interruptedBatch.setProcessingCount(1);
        interruptedBatch.setStartedAt(Instant.now().minusSeconds(120));
        batches.put(interruptedBatch.getId(), interruptedBatch);

        ExamAiGradingBatchItem item1 = new ExamAiGradingBatchItem();
        item1.setId(9001L);
        item1.setBatch(interruptedBatch);
        item1.setAttemptId(att1.getId());
        item1.setExamId(exam.getId());
        item1.setStudentId(student1.getId());
        item1.setStudentName("Student One");
        item1.setEssayCount(1);
        item1.setAiGradedEssayCount(1);
        item1.setProposedTotalEssayScore(new BigDecimal("8.00"));
        item1.setStatus(AiEssayGradingState.AI_COMPLETED);
        batchItems.put(item1.getId(), item1);

        ExamAiGradingBatchItem item2 = new ExamAiGradingBatchItem();
        item2.setId(9002L);
        item2.setBatch(interruptedBatch);
        item2.setAttemptId(att2.getId());
        item2.setExamId(exam.getId());
        item2.setStudentId(student2.getId());
        item2.setStudentName("Student Two");
        item2.setEssayCount(1);
        item2.setAiGradedEssayCount(0);
        item2.setStatus(AiEssayGradingState.PROCESSING);
        batchItems.put(item2.getId(), item2);

        when(aiClient.requestProposal(anyList()))
                .thenReturn(mockValidAiResponse(501L, new BigDecimal("7.50"), "Recovered after restart"));

        batchService.recoverInterruptedBatches();

        verify(aiClient, times(1)).requestProposal(anyList());

        EssayGradingDTO.BatchStatusDTO recoveredStatus = batchService.getBatchStatus(exam.getId(), interruptedBatch.getId());
        assertEquals(AiGradingBatchStatus.COMPLETED.name(), recoveredStatus.getStatus());
        assertEquals(2, recoveredStatus.getCompletedCount());
        assertEquals(0, recoveredStatus.getProcessingCount());

        assertEquals(0, new BigDecimal("8.00").compareTo(gradingService.getDetail(exam.getId(), att1.getId()).getEssays().get(0).getAiProposal().getProposedScore()));
        assertEquals(0, new BigDecimal("7.50").compareTo(gradingService.getDetail(exam.getId(), att2.getId()).getEssays().get(0).getAiProposal().getProposedScore()));
    }

    @Test
    @DisplayName("Scenarios 10 & 17: Grader receives notification when batch completes, and no duplicate notification is sent")
    void scenario10And17_notificationSentOnceOnCompletion() {
        createEssayAttempt(student1, ExamAttemptStatus.PENDING_REVIEW, "Answer 1");
        when(aiClient.requestProposal(anyList()))
                .thenReturn(mockValidAiResponse(501L, new BigDecimal("9.00"), "Great"));

        EssayGradingDTO.BatchStatusDTO status = batchService.startBatch(exam.getId(), null);
        assertTrue(status.isNotificationSent());

        String eventKey = "exam.ai.batch.completed." + status.getBatchId() + ".user." + teacherOwner.getId();
        verify(notificationService, times(1)).createOnce(
                eq(teacherOwner.getId()),
                eq(eventKey),
                contains(exam.getTitle()),
                contains("AI đã hoàn thành chấm bài tự luận"),
                eq("/exams/" + exam.getId() + "/grading?filter=AI_COMPLETED")
        );

        batchService.recoverInterruptedBatches();
        verify(notificationService, times(1)).createOnce(
                eq(teacherOwner.getId()),
                eq(eventKey),
                anyString(),
                anyString(),
                anyString()
        );
    }

    @Test
    @DisplayName("Scenarios 11, 12, 13, 15, 16: Review queue pagination, student visibility protection, teacher confirmation (keep or edit score), and protection against AI overwriting confirmed grades")
    void scenario11_12_13_15_16_reviewConfirmEditAndProtectOfficialGrade() {
        ExamAttempt att1 = createEssayAttempt(student1, ExamAttemptStatus.PENDING_REVIEW, "Answer 1");
        ExamAttempt att2 = createEssayAttempt(student2, ExamAttemptStatus.PENDING_REVIEW, "Answer 2");

        when(aiClient.requestProposal(anyList()))
                .thenReturn(mockValidAiResponse(501L, new BigDecimal("8.00"), "AI feedback for S1"))
                .thenReturn(mockValidAiResponse(501L, new BigDecimal("6.00"), "AI feedback for S2"));

        batchService.startBatch(exam.getId(), null);

        // Scenario 11: Paginated list of attempts waiting for confirmation (AI_COMPLETED)
        Page<EssayGradingDTO.Summary> queue = batchService.listReviewQueue(
                exam.getId(),
                "AI_COMPLETED",
                null,
                PageRequest.of(0, 10)
        );
        assertEquals(2, queue.getTotalElements());

        // Scenario 15: Before teacher confirmation, official answer.score, answer.feedback, and attempt.finalScore are null (student cannot see AI draft)
        ExamAttemptAnswer ans1Before = att1.getAnswers().iterator().next();
        assertNull(att1.getFinalScore(), "Student must not see unconfirmed final score");
        assertNull(ans1Before.getScore(), "Official score column read by student review must be null before teacher confirmation");
        assertNull(ans1Before.getFeedback(), "Official feedback column read by student review must be null before teacher confirmation");
        assertNotNull(ans1Before.getAiProposedScore(), "AI draft score is stored separately in aiProposedScore");

        // Scenario 12: Grader keeps AI proposed score (8.00) and confirms att1
        EssayGradingDTO.QuestionGrade confirmGrade1 = new EssayGradingDTO.QuestionGrade();
        confirmGrade1.setQuestionId(501L);
        confirmGrade1.setScore(new BigDecimal("8.00"));
        confirmGrade1.setFeedback("AI feedback for S1");
        EssayGradingDTO.GradeSubmissionRequest req1 = new EssayGradingDTO.GradeSubmissionRequest();
        req1.setGrades(List.of(confirmGrade1));

        EssayGradingDTO.Detail confirmed1 = gradingService.submitOfficialGrade(exam.getId(), att1.getId(), req1);
        assertEquals(AiEssayGradingState.CONFIRMED.name(), confirmed1.getAiGradingState());
        assertEquals(teacherOwner.getId(), confirmed1.getConfirmedBy());
        assertNotNull(confirmed1.getConfirmedAt());
        assertEquals(0, new BigDecimal("18.00").compareTo(confirmed1.getFinalScore()));

        // Scenario 13: Grader edits AI score (from 6.00 to 9.50) and edits feedback before confirming att2
        EssayGradingDTO.QuestionGrade editedGrade2 = new EssayGradingDTO.QuestionGrade();
        editedGrade2.setQuestionId(501L);
        editedGrade2.setScore(new BigDecimal("9.50"));
        editedGrade2.setFeedback("Teacher edited feedback after reviewing AI suggestion");
        EssayGradingDTO.GradeSubmissionRequest req2 = new EssayGradingDTO.GradeSubmissionRequest();
        req2.setGrades(List.of(editedGrade2));

        EssayGradingDTO.Detail confirmed2 = gradingService.submitOfficialGrade(exam.getId(), att2.getId(), req2);
        assertEquals(AiEssayGradingState.CONFIRMED.name(), confirmed2.getAiGradingState());
        assertEquals(0, new BigDecimal("9.50").compareTo(confirmed2.getEssays().get(0).getScore()));
        assertEquals("Teacher edited feedback after reviewing AI suggestion", confirmed2.getEssays().get(0).getFeedback());
        assertEquals(0, new BigDecimal("19.50").compareTo(confirmed2.getFinalScore()));

        // Scenario 16: Confirmed attempts are NEVER overwritten by subsequent AI batch or single AI grading
        reset(aiClient);
        EssayGradingDTO.StartBatchRequest forceAll = new EssayGradingDTO.StartBatchRequest();
        forceAll.setScope(BatchAiEssayGradingService.SCOPE_ALL_ELIGIBLE);
        EssayGradingDTO.BatchStatusDTO rerunBatch = batchService.startBatch(exam.getId(), forceAll);
        assertEquals(0, rerunBatch.getTotalAttempts(), "Confirmed attempts must be excluded from AI batch processing");
        verify(aiClient, never()).requestProposal(anyList());

        assertThrows(BadRequestException.class, () -> gradingService.requestAiGrading(exam.getId(), att2.getId(), null));
    }

    @Test
    @DisplayName("Scenario 14: Unauthorized user (another teacher or student) cannot start batch or confirm grade")
    void scenario14_unauthorizedUserCannotStartBatchOrConfirmGrade() {
        ExamAttempt att1 = createEssayAttempt(student1, ExamAttemptStatus.PENDING_REVIEW, "Answer 1");

        authenticateAs(otherTeacher);
        assertThrows(AccessDeniedException.class, () -> batchService.previewBatch(exam.getId()));
        assertThrows(AccessDeniedException.class, () -> batchService.startBatch(exam.getId(), null));

        EssayGradingDTO.QuestionGrade g = new EssayGradingDTO.QuestionGrade();
        g.setQuestionId(501L);
        g.setScore(new BigDecimal("5.00"));
        EssayGradingDTO.GradeSubmissionRequest req = new EssayGradingDTO.GradeSubmissionRequest();
        req.setGrades(List.of(g));
        assertThrows(AccessDeniedException.class, () -> gradingService.submitOfficialGrade(exam.getId(), att1.getId(), req));

        authenticateAs(student1);
        assertThrows(AccessDeniedException.class, () -> batchService.startBatch(exam.getId(), null));
        assertThrows(AccessDeniedException.class, () -> gradingService.submitOfficialGrade(exam.getId(), att1.getId(), req));
    }

    @Test
    @DisplayName("New Feature 1 & 2 & 3: Auto-generate rubric/reference when left blank, flag low-score/fail attempts, and require 'APPLY ALL' for bulk confirm while skipping flagged attempts")
    void scenario18_autoGuidelinesLowScoreFlagAndBulkConfirmApplyAll() {
        ExamAttempt passingAttempt = createEssayAttempt(student1, ExamAttemptStatus.PENDING_REVIEW, "Comprehensive answer on Spring transactions");
        ExamAttempt lowScoreAttempt = createEssayAttempt(student2, ExamAttemptStatus.PENDING_REVIEW, "Very short weak answer");

        // AI proposes 8.5/10 for student 1 (passing) and 2.0/10 for student 2 (low score < 50% essay max -> flagged)
        when(aiClient.requestProposal(anyList()))
                .thenReturn(mockValidAiResponse(501L, new BigDecimal("8.50"), "Great job S1"))
                .thenReturn(mockValidAiResponse(501L, new BigDecimal("2.00"), "Incomplete answer S2"));

        // Start batch with blank rubric & reference answer -> AI auto-fills guidelines
        EssayGradingDTO.StartBatchRequest startReq = new EssayGradingDTO.StartBatchRequest();
        startReq.setScope(BatchAiEssayGradingService.SCOPE_UNGRADED_ONLY);
        startReq.setRubric("   ");
        startReq.setReferenceAnswer("");
        startReq.setAutoGenerateGuidelines(true);

        batchService.startBatch(exam.getId(), startReq);

        // Verify guidelines were auto-generated for question 501
        EssayGradingDTO.QuestionGuidelineDTO guidelines = gradingService.getQuestionGuidelines(exam.getId(), 501L);
        assertNotNull(guidelines.getRubric(), "Rubric should be auto-generated when left blank");
        assertFalse(guidelines.getRubric().isBlank());
        assertNotNull(guidelines.getReferenceAnswer(), "Reference answer should be auto-generated when left blank");
        assertFalse(guidelines.getReferenceAnswer().isBlank());

        // Verify preview counts: 1 auto-confirmable, 1 lowScoreFlagged
        EssayGradingDTO.BatchPreviewDTO preview = batchService.previewBatch(exam.getId());
        assertEquals(2, preview.getAlreadyAiGradedCount());
        assertEquals(1, preview.getAutoConfirmableCount());
        assertEquals(1, preview.getLowScoreFlaggedCount());

        // Verify detail flags
        EssayGradingDTO.Detail passingDetail = gradingService.getDetail(exam.getId(), passingAttempt.getId());
        assertFalse(passingDetail.isLowScoreFlagged());

        EssayGradingDTO.Detail lowDetail = gradingService.getDetail(exam.getId(), lowScoreAttempt.getId());
        assertTrue(lowDetail.isLowScoreFlagged(), "Attempt with 2.0/10 essay score (<50%) must be flagged");
        assertNotNull(lowDetail.getLowScoreReason());

        // Bulk confirm must reject wrong confirmation text
        EssayGradingDTO.BulkConfirmRequest wrongConfirm = new EssayGradingDTO.BulkConfirmRequest();
        wrongConfirm.setConfirmationText("yes");
        assertThrows(BadRequestException.class, () -> batchService.bulkConfirmAiGrades(exam.getId(), wrongConfirm));

        // Bulk confirm with 'apply all' confirms ONLY the passing attempt and leaves the low-score attempt for manual teacher confirmation
        EssayGradingDTO.BulkConfirmRequest validConfirm = new EssayGradingDTO.BulkConfirmRequest();
        validConfirm.setConfirmationText("apply all");
        EssayGradingDTO.BulkConfirmResultDTO bulkRes = batchService.bulkConfirmAiGrades(exam.getId(), validConfirm);

        assertEquals(1, bulkRes.getConfirmedCount());
        assertEquals(1, bulkRes.getSkippedLowScoreCount());
        assertTrue(bulkRes.getConfirmedAttemptIds().contains(passingAttempt.getId()));
        assertTrue(bulkRes.getSkippedLowScoreAttemptIds().contains(lowScoreAttempt.getId()));

        // Verify passingAttempt is now CONFIRMED, while lowScoreAttempt remains AI_COMPLETED waiting for manual teacher check
        assertEquals(AiEssayGradingState.CONFIRMED.name(), gradingService.getDetail(exam.getId(), passingAttempt.getId()).getAiGradingState());
        assertNotNull(gradingService.getDetail(exam.getId(), passingAttempt.getId()).getFinalScore());

        EssayGradingDTO.Detail lowAfterBulk = gradingService.getDetail(exam.getId(), lowScoreAttempt.getId());
        assertEquals(AiEssayGradingState.AI_COMPLETED.name(), lowAfterBulk.getAiGradingState(), "Low-score attempt must NOT be auto-confirmed");
        assertNull(lowAfterBulk.getFinalScore(), "Low-score attempt finalScore must remain null until teacher manually confirms");
    }
}
