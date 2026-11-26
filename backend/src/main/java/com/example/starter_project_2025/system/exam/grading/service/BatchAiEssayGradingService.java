package com.example.starter_project_2025.system.exam.grading.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.ai.AiEssayGradingClient;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.grading.domain.AiEssayGradingState;
import com.example.starter_project_2025.system.exam.grading.domain.AiGradingBatchStatus;
import com.example.starter_project_2025.system.exam.grading.domain.ExamAiGradingBatch;
import com.example.starter_project_2025.system.exam.grading.domain.ExamAiGradingBatchItem;
import com.example.starter_project_2025.system.exam.grading.domain.ExamAiGradingBatchItemRepository;
import com.example.starter_project_2025.system.exam.grading.domain.ExamAiGradingBatchRepository;
import com.example.starter_project_2025.system.exam.grading.dto.EssayGradingDTO;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class BatchAiEssayGradingService {

    public static final String SCOPE_UNGRADED_ONLY = "UNGRADED_ONLY";
    public static final String SCOPE_FAILED_ONLY = "FAILED_ONLY";
    public static final String SCOPE_ALL_ELIGIBLE = "ALL_ELIGIBLE";

    private static final int MAX_RETRIES = 2;
    private static final int MAX_CONCURRENCY = 2;

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamAiGradingBatchRepository batchRepository;
    private final ExamAiGradingBatchItemRepository itemRepository;
    private final ExamEssayGradingService essayGradingService;
    private final AiEssayGradingClient aiClient;
    private final PlatformTransactionManager transactionManager;

    @Autowired(required = false)
    private NotificationService notificationService;

    private final ExecutorService batchExecutor = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "ai-batch-grader");
        t.setDaemon(true);
        return t;
    });

    private final ExecutorService itemWorkerPool = Executors.newFixedThreadPool(MAX_CONCURRENCY, r -> {
        Thread t = new Thread(r, "ai-item-worker");
        t.setDaemon(true);
        return t;
    });

    private final ConcurrentHashMap<Long, Object> examLocks = new ConcurrentHashMap<>();
    private final Set<Long> runningBatchIds = ConcurrentHashMap.newKeySet();

    /** Cho phép cấu hình chạy đồng bộ trong Unit Test và giảm delay retry. */
    private volatile boolean runSynchronously = false;
    private volatile long retryDelayMs = 250L;

    public void setRunSynchronously(boolean runSynchronously) {
        this.runSynchronously = runSynchronously;
    }

    public void setRetryDelayMs(long retryDelayMs) {
        this.retryDelayMs = retryDelayMs;
    }

    @PreDestroy
    public void shutdown() {
        batchExecutor.shutdownNow();
        itemWorkerPool.shutdownNow();
    }

    private TransactionTemplate txTemplate() {
        TransactionTemplate tt = new TransactionTemplate(transactionManager);
        tt.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
        return tt;
    }

    private TransactionTemplate readOnlyTxTemplate() {
        TransactionTemplate tt = new TransactionTemplate(transactionManager);
        tt.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
        tt.setReadOnly(true);
        return tt;
    }

    /**
     * 1. Pre-check summary trước khi bấm xác nhận chạy Batch AI Grading.
     */
    public EssayGradingDTO.BatchPreviewDTO previewBatch(Long examId) {
        return readOnlyTxTemplate().execute(status -> {
            Exam exam = essayGradingService.requireExam(examId);
            List<ExamAttempt> allAttempts = attemptRepository.findAllByExam_Id(examId);

            int totalSubmitted = 0;
            int eligibleCount = 0;
            int alreadyAiGradedCount = 0;
            int ungradedCount = 0;
            int failedCount = 0;
            int confirmedCount = 0;
            int ineligibleCount = 0;
            int lowScoreFlaggedCount = 0;
            int autoConfirmableCount = 0;

            for (ExamAttempt attempt : allAttempts) {
                if (!isSubmittedAttempt(attempt)) {
                    ineligibleCount++;
                    continue;
                }
                totalSubmitted++;

                if (!hasAnsweredEssayQuestions(attempt)) {
                    ineligibleCount++;
                    continue;
                }

                if (isConfirmedOfficial(attempt)) {
                    confirmedCount++;
                    ineligibleCount++;
                    continue;
                }

                eligibleCount++;
                String state = essayGradingService.resolveAiGradingState(attempt);
                if (AiEssayGradingState.AI_COMPLETED.name().equals(state)) {
                    alreadyAiGradedCount++;
                    if (essayGradingService.isLowScoreOrFailFlagged(attempt)) {
                        lowScoreFlaggedCount++;
                    } else {
                        autoConfirmableCount++;
                    }
                } else if (AiEssayGradingState.FAILED.name().equals(state)) {
                    failedCount++;
                    lowScoreFlaggedCount++;
                } else {
                    ungradedCount++;
                }
            }

            EssayGradingDTO.BatchPreviewDTO dto = new EssayGradingDTO.BatchPreviewDTO();
            dto.setExamId(examId);
            dto.setExamTitle(exam.getTitle());
            dto.setTotalSubmitted(totalSubmitted);
            dto.setEligibleCount(eligibleCount);
            dto.setAlreadyAiGradedCount(alreadyAiGradedCount);
            dto.setUngradedCount(ungradedCount);
            dto.setFailedCount(failedCount);
            dto.setConfirmedCount(confirmedCount);
            dto.setIneligibleCount(ineligibleCount);
            dto.setLowScoreFlaggedCount(lowScoreFlaggedCount);
            dto.setAutoConfirmableCount(autoConfirmableCount);

            essayGradingService.findExamGradingConfigs(examId).stream().findFirst().ifPresent(cfg -> {
                dto.setSavedReferenceAnswer(cfg.getReferenceAnswer());
                dto.setSavedRubric(cfg.getRubric());
            });

            batchRepository.findFirstByExamIdAndStatusInOrderByCreatedAtDesc(
                    examId,
                    List.of(AiGradingBatchStatus.PENDING, AiGradingBatchStatus.PROCESSING)
            ).ifPresent(active -> {
                dto.setActiveBatchId(active.getId());
                dto.setActiveBatchStatus(active.getStatus().name());
            });

            return dto;
        });
    }

    /**
     * 2. Khởi chạy Batch AI Grading (chống chạy trùng / idempotent).
     */
    public EssayGradingDTO.BatchStatusDTO startBatch(Long examId, EssayGradingDTO.StartBatchRequest request) {
        Exam exam = essayGradingService.requireExam(examId);
        Long currentUserId = essayGradingService.currentUserIdOrNull();

        Object lock = examLocks.computeIfAbsent(examId, k -> new Object());
        ExamAiGradingBatch createdOrExisting;
        boolean newlyCreated = false;

        synchronized (lock) {
            Optional<ExamAiGradingBatch> activeOpt = batchRepository.findFirstByExamIdAndStatusInOrderByCreatedAtDesc(
                    examId,
                    List.of(AiGradingBatchStatus.PENDING, AiGradingBatchStatus.PROCESSING)
            );
            if (activeOpt.isPresent()) {
                return getBatchStatus(examId, activeOpt.get().getId());
            }

            String scope = normalizeScope(request != null ? request.getScope() : null);
            Set<Long> requestedAttemptIds = (request != null && request.getAttemptIds() != null && !request.getAttemptIds().isEmpty())
                    ? new HashSet<>(request.getAttemptIds())
                    : null;
            String customRef = request != null && request.getReferenceAnswer() != null ? request.getReferenceAnswer().trim() : "";
            String customRubric = request != null && request.getRubric() != null ? request.getRubric().trim() : "";
            boolean autoGen = request == null || request.getAutoGenerateGuidelines() == null || request.getAutoGenerateGuidelines();

            createdOrExisting = txTemplate().execute(status -> {
                essayGradingService.applyOrAutoGenerateExamGuidelines(examId, customRef, customRubric, autoGen);

                List<ExamAttempt> allAttempts = attemptRepository.findAllByExam_Id(examId);
                allAttempts.sort(Comparator.comparing(ExamAttempt::getId));

                ExamAiGradingBatch batch = new ExamAiGradingBatch();
                batch.setExamId(examId);
                batch.setExamTitle(exam.getTitle());
                batch.setTriggeredByUserId(currentUserId != null ? currentUserId : exam.getCreatedBy());
                batch.setScope(scope);
                batch.setCustomReferenceAnswer(customRef.isEmpty() ? null : customRef);
                batch.setCustomRubric(customRubric.isEmpty() ? null : customRubric);
                batch.setAutoGenerateGuidelines(autoGen);
                batch.setStatus(AiGradingBatchStatus.PENDING);
                batch.setStartedAt(Instant.now());
                batch = batchRepository.save(batch);

                int pendingCount = 0;
                int skippedCount = 0;

                for (ExamAttempt attempt : allAttempts) {
                    if (requestedAttemptIds != null && !requestedAttemptIds.contains(attempt.getId())) {
                        continue;
                    }
                    // Bài chưa nộp: không đưa vào xử lý
                    if (!isSubmittedAttempt(attempt)) {
                        continue;
                    }
                    // Bài đã xác nhận điểm chính thức: tuyệt đối không đưa vào AI chấm tự động
                    if (isConfirmedOfficial(attempt)) {
                        continue;
                    }

                    List<ExamAttemptQuestion> essays = attempt.getQuestions().stream()
                            .filter(q -> q.getType() == QuestionType.ESSAY)
                            .toList();

                    if (!hasAnsweredEssayQuestions(attempt)) {
                        ExamAiGradingBatchItem skippedItem = new ExamAiGradingBatchItem();
                        skippedItem.setBatch(batch);
                        skippedItem.setAttemptId(attempt.getId());
                        skippedItem.setExamId(examId);
                        if (attempt.getStudent() != null) {
                            skippedItem.setStudentId(attempt.getStudent().getId());
                            skippedItem.setStudentName(fullName(attempt.getStudent()));
                        }
                        skippedItem.setEssayCount(essays.size());
                        skippedItem.setAiGradedEssayCount(0);
                        skippedItem.setStatus(AiEssayGradingState.SKIPPED);
                        skippedItem.setErrorMessage("Bài thi không có câu trả lời tự luận.");
                        skippedItem.setFinishedAt(Instant.now());
                        itemRepository.save(skippedItem);

                        attempt.setAiGradingState(AiEssayGradingState.SKIPPED);
                        attemptRepository.save(attempt);
                        skippedCount++;
                        continue;
                    }

                    String currentState = essayGradingService.resolveAiGradingState(attempt);
                    boolean shouldProcess = switch (scope) {
                        case SCOPE_FAILED_ONLY -> AiEssayGradingState.FAILED.name().equals(currentState);
                        case SCOPE_ALL_ELIGIBLE -> true;
                        default -> !AiEssayGradingState.AI_COMPLETED.name().equals(currentState);
                    };

                    if (!shouldProcess) {
                        continue;
                    }

                    ExamAiGradingBatchItem item = new ExamAiGradingBatchItem();
                    item.setBatch(batch);
                    item.setAttemptId(attempt.getId());
                    item.setExamId(examId);
                    if (attempt.getStudent() != null) {
                        item.setStudentId(attempt.getStudent().getId());
                        item.setStudentName(fullName(attempt.getStudent()));
                    }
                    item.setEssayCount(essays.size());
                    item.setAiGradedEssayCount(0);
                    item.setStatus(AiEssayGradingState.PENDING);
                    itemRepository.save(item);

                    attempt.setAiGradingState(AiEssayGradingState.PENDING);
                    attempt.setAiGradingError(null);
                    attemptRepository.save(attempt);
                    pendingCount++;
                }

                batch.setTotalAttempts(pendingCount + skippedCount);
                batch.setPendingCount(pendingCount);
                batch.setProcessingCount(0);
                batch.setCompletedCount(0);
                batch.setFailedCount(0);
                batch.setSkippedCount(skippedCount);

                if (pendingCount == 0) {
                    batch.setStatus(AiGradingBatchStatus.COMPLETED);
                    batch.setCompletedAt(Instant.now());
                }
                return batchRepository.save(batch);
            });
            newlyCreated = true;
        }

        if (newlyCreated && createdOrExisting != null) {
            if (createdOrExisting.getPendingCount() > 0) {
                dispatchBatchExecution(createdOrExisting.getId());
            } else {
                finalizeBatchAndNotifyIfNeeded(createdOrExisting.getId());
            }
        }

        return getBatchStatus(examId, createdOrExisting.getId());
    }

    private void dispatchBatchExecution(Long batchId) {
        if (!runningBatchIds.add(batchId)) {
            return;
        }
        Runnable task = () -> {
            try {
                executeBatchLoop(batchId);
            } catch (Exception e) {
                log.error("Unexpected error while executing AI grading batch {}", batchId, e);
            } finally {
                runningBatchIds.remove(batchId);
            }
        };
        if (runSynchronously) {
            task.run();
        } else {
            batchExecutor.submit(task);
        }
    }

    /**
     * 3. Vòng lặp xử lý bất đồng bộ với giới hạn Concurrency (MAX_CONCURRENCY = 2).
     */
    private void executeBatchLoop(Long batchId) {
        List<Long> pendingItemIds = txTemplate().execute(status -> {
            ExamAiGradingBatch batch = batchRepository.findById(batchId).orElse(null);
            if (batch == null) {
                return List.<Long>of();
            }
            if (batch.getStatus() == AiGradingBatchStatus.PENDING) {
                batch.setStatus(AiGradingBatchStatus.PROCESSING);
                if (batch.getStartedAt() == null) {
                    batch.setStartedAt(Instant.now());
                }
                batchRepository.save(batch);
            }
            return itemRepository.findByBatch_IdAndStatusInOrderByIdAsc(
                            batchId,
                            List.of(AiEssayGradingState.PENDING)
                    )
                    .stream()
                    .map(ExamAiGradingBatchItem::getId)
                    .toList();
        });

        if (pendingItemIds == null || pendingItemIds.isEmpty()) {
            finalizeBatchAndNotifyIfNeeded(batchId);
            return;
        }

        if (runSynchronously) {
            for (Long itemId : pendingItemIds) {
                processSingleItemSafely(batchId, itemId);
            }
        } else {
            List<Future<?>> futures = new ArrayList<>();
            for (Long itemId : pendingItemIds) {
                futures.add(itemWorkerPool.submit(() -> processSingleItemSafely(batchId, itemId)));
            }
            for (Future<?> f : futures) {
                try {
                    f.get();
                } catch (Exception e) {
                    log.warn("Worker task interrupted or failed in batch {}", batchId, e);
                }
            }
        }

        finalizeBatchAndNotifyIfNeeded(batchId);
    }

    private record PreparedItemContext(
            Long attemptId,
            Long examId,
            boolean skipOrConfirmed,
            String skipReason,
            List<AiEssayGradingClient.EssayQuestionPayload> payloads
    ) {}

    private void processSingleItemSafely(Long batchId, Long itemId) {
        try {
            // Bước 1: Transaction ngắn đánh dấu PROCESSING và nạp payloads
            PreparedItemContext ctx = txTemplate().execute(status -> {
                ExamAiGradingBatchItem item = itemRepository.findById(itemId).orElse(null);
                if (item == null || item.getStatus() != AiEssayGradingState.PENDING) {
                    return null;
                }
                ExamAttempt attempt = attemptRepository.findById(item.getAttemptId()).orElse(null);
                if (attempt == null || !isSubmittedAttempt(attempt)) {
                    item.setStatus(AiEssayGradingState.SKIPPED);
                    item.setErrorMessage("Bài làm không tồn tại hoặc chưa nộp.");
                    item.setFinishedAt(Instant.now());
                    itemRepository.save(item);
                    recomputeBatchCountersInTx(batchId, null);
                    return new PreparedItemContext(item.getAttemptId(), item.getExamId(), true, "Not submitted", List.of());
                }
                if (isConfirmedOfficial(attempt)) {
                    item.setStatus(AiEssayGradingState.CONFIRMED);
                    item.setErrorMessage("Bài làm đã được giáo viên xác nhận chính thức.");
                    item.setFinishedAt(Instant.now());
                    itemRepository.save(item);
                    recomputeBatchCountersInTx(batchId, null);
                    return new PreparedItemContext(attempt.getId(), item.getExamId(), true, "Already confirmed", List.of());
                }
                if (!hasAnsweredEssayQuestions(attempt)) {
                    item.setStatus(AiEssayGradingState.SKIPPED);
                    item.setErrorMessage("Bài làm không có câu trả lời tự luận.");
                    item.setFinishedAt(Instant.now());
                    itemRepository.save(item);
                    attempt.setAiGradingState(AiEssayGradingState.SKIPPED);
                    attemptRepository.save(attempt);
                    recomputeBatchCountersInTx(batchId, null);
                    return new PreparedItemContext(attempt.getId(), item.getExamId(), true, "No essay answers", List.of());
                }

                item.setStatus(AiEssayGradingState.PROCESSING);
                item.setStartedAt(Instant.now());
                item.setErrorMessage(null);
                itemRepository.save(item);

                attempt.setAiGradingState(AiEssayGradingState.PROCESSING);
                attempt.setAiGradingError(null);
                attemptRepository.save(attempt);

                List<AiEssayGradingClient.EssayQuestionPayload> payloads =
                        essayGradingService.buildEssayPayloads(item.getExamId(), attempt, null);
                recomputeBatchCountersInTx(batchId, null);
                return new PreparedItemContext(attempt.getId(), item.getExamId(), false, null, payloads);
            });

            if (ctx == null || ctx.skipOrConfirmed()) {
                return;
            }

            // Bước 2: Gọi AI ngoài transaction với cơ chế Retry hợp lý (tối đa MAX_RETRIES = 2 lần thử lại)
            EssayGradingDTO.AiGradingResponse aiResponse = null;
            Exception lastException = null;
            int retriesUsed = 0;

            for (int attemptNum = 0; attemptNum <= MAX_RETRIES; attemptNum++) {
                if (attemptNum > 0) {
                    retriesUsed = attemptNum;
                    int finalRetries = retriesUsed;
                    txTemplate().executeWithoutResult(status -> {
                        itemRepository.findById(itemId).ifPresent(it -> {
                            it.setRetryCount(finalRetries);
                            itemRepository.save(it);
                        });
                    });
                    if (retryDelayMs > 0) {
                        try {
                            Thread.sleep(retryDelayMs * attemptNum);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                    }
                }
                try {
                    EssayGradingDTO.AiGradingResponse candidate = aiClient.requestProposal(ctx.payloads());
                    validateAiResponseStrictly(candidate, ctx.payloads());
                    aiResponse = candidate;
                    lastException = null;
                    break;
                } catch (Exception ex) {
                    lastException = ex;
                    if (!isRetryableError(ex) || attemptNum == MAX_RETRIES) {
                        break;
                    }
                    log.warn("Transient AI error on attempt {} (retry {}/{}): {}",
                            ctx.attemptId(), attemptNum + 1, MAX_RETRIES, ex.getMessage());
                }
            }

            // Bước 3: Transaction ngắn lưu kết quả nháp hoặc trạng thái FAILED
            final EssayGradingDTO.AiGradingResponse finalResponse = aiResponse;
            final Exception finalError = lastException;
            final int finalRetryCount = retriesUsed;

            txTemplate().executeWithoutResult(status -> {
                ExamAiGradingBatchItem item = itemRepository.findById(itemId).orElse(null);
                ExamAttempt attempt = attemptRepository.findById(ctx.attemptId()).orElse(null);
                if (item == null || attempt == null) {
                    return;
                }
                item.setRetryCount(finalRetryCount);
                item.setFinishedAt(Instant.now());

                // Kiểm tra lại xem trong lúc chờ AI thì giáo viên có xác nhận tay bài này không
                if (isConfirmedOfficial(attempt)) {
                    item.setStatus(AiEssayGradingState.CONFIRMED);
                    itemRepository.save(item);
                    recomputeBatchCountersInTx(batchId, null);
                    return;
                }

                if (finalResponse != null && finalError == null) {
                    essayGradingService.persistAiDraftProposals(attempt, finalResponse);
                    item.setStatus(AiEssayGradingState.AI_COMPLETED);
                    item.setAiGradedEssayCount(finalResponse.getProposals() != null ? finalResponse.getProposals().size() : 0);
                    item.setProposedTotalEssayScore(attempt.getAiProposedEssayScore());
                    item.setErrorMessage(null);
                    itemRepository.save(item);
                    recomputeBatchCountersInTx(batchId, null);
                } else {
                    String errMsg = finalError != null && finalError.getMessage() != null
                            ? truncate(finalError.getMessage(), 950)
                            : "Lỗi không xác định khi chấm bài bằng AI";
                    item.setStatus(AiEssayGradingState.FAILED);
                    item.setErrorMessage(errMsg);
                    itemRepository.save(item);

                    attempt.setAiGradingState(AiEssayGradingState.FAILED);
                    attempt.setAiGradingError(errMsg);
                    attemptRepository.save(attempt);
                    recomputeBatchCountersInTx(batchId, errMsg);
                }
            });
        } catch (Exception unexpected) {
            log.error("Unhandled error processing batch item {}", itemId, unexpected);
            txTemplate().executeWithoutResult(status -> {
                itemRepository.findById(itemId).ifPresent(item -> {
                    String msg = truncate(unexpected.getMessage() != null ? unexpected.getMessage() : "Unexpected error", 950);
                    item.setStatus(AiEssayGradingState.FAILED);
                    item.setErrorMessage(msg);
                    item.setFinishedAt(Instant.now());
                    itemRepository.save(item);
                    attemptRepository.findById(item.getAttemptId()).ifPresent(att -> {
                        if (!isConfirmedOfficial(att)) {
                            att.setAiGradingState(AiEssayGradingState.FAILED);
                            att.setAiGradingError(msg);
                            attemptRepository.save(att);
                        }
                    });
                    recomputeBatchCountersInTx(batchId, msg);
                });
            });
        }
    }

    /**
     * Kiểm tra nghiêm ngặt JSON/Proposal trả về từ AI:
     * - Không được null hoặc rỗng
     * - Mọi câu hỏi tự luận phải có điểm đề xuất hợp lệ: 0 <= score <= maxPoints
     */
    private void validateAiResponseStrictly(
            EssayGradingDTO.AiGradingResponse response,
            List<AiEssayGradingClient.EssayQuestionPayload> payloads
    ) {
        if (response == null || response.getProposals() == null || response.getProposals().isEmpty()) {
            throw new BadRequestException("AI trả về dữ liệu rỗng hoặc sai định dạng JSON.");
        }
        Map<Long, BigDecimal> maxPointsMap = new HashMap<>();
        for (AiEssayGradingClient.EssayQuestionPayload p : payloads) {
            maxPointsMap.put(p.questionId(), p.maxPoints());
        }
        for (EssayGradingDTO.AiQuestionProposal proposal : response.getProposals()) {
            if (proposal == null || proposal.getQuestionId() == null) {
                throw new BadRequestException("AI trả về proposal thiếu questionId.");
            }
            BigDecimal score = proposal.getProposedScore();
            if (score == null) {
                throw new BadRequestException("AI không trả về điểm đề xuất cho câu hỏi " + proposal.getQuestionId());
            }
            BigDecimal maxPoints = maxPointsMap.get(proposal.getQuestionId());
            if (score.signum() < 0) {
                throw new BadRequestException("Điểm AI đề xuất không hợp lệ (điểm âm: " + score + ").");
            }
            if (maxPoints != null && score.compareTo(maxPoints) > 0) {
                throw new BadRequestException("Điểm AI đề xuất vượt quá điểm tối đa của câu hỏi (" + score + " > " + maxPoints + ").");
            }
        }
    }

    private boolean isRetryableError(Exception ex) {
        if (ex == null) return false;
        String msg = ex.getMessage() != null ? ex.getMessage().toLowerCase(Locale.ROOT) : "";
        if (msg.contains("timed out") || msg.contains("timeout")
                || msg.contains("network") || msg.contains("connection")
                || msg.contains("rate limit") || msg.contains("quota")
                || msg.contains("500") || msg.contains("502") || msg.contains("503") || msg.contains("504")
                || msg.contains("temporary")) {
            return true;
        }
        return ex instanceof org.springframework.web.client.ResourceAccessException
                || ex instanceof org.springframework.web.client.HttpServerErrorException;
    }

    private void recomputeBatchCountersInTx(Long batchId, String latestError) {
        ExamAiGradingBatch batch = batchRepository.findById(batchId).orElse(null);
        if (batch == null) {
            return;
        }
        List<ExamAiGradingBatchItem> items = itemRepository.findByBatch_IdOrderByIdAsc(batchId);
        int pending = 0;
        int processing = 0;
        int completed = 0;
        int failed = 0;
        int skipped = 0;

        for (ExamAiGradingBatchItem it : items) {
            if (it.getStatus() == null) continue;
            switch (it.getStatus()) {
                case PENDING -> pending++;
                case PROCESSING -> processing++;
                case AI_COMPLETED, CONFIRMED -> completed++;
                case FAILED -> failed++;
                case SKIPPED -> skipped++;
            }
        }

        batch.setTotalAttempts(items.size());
        batch.setPendingCount(pending);
        batch.setProcessingCount(processing);
        batch.setCompletedCount(completed);
        batch.setFailedCount(failed);
        batch.setSkippedCount(skipped);
        if (latestError != null && !latestError.isBlank()) {
            batch.setLastError(truncate(latestError, 950));
        }
        batchRepository.save(batch);
    }

    /**
     * 4. Hoàn tất Batch và gửi Notification 1 lần duy nhất cho người chấm phụ trách.
     */
    private void finalizeBatchAndNotifyIfNeeded(Long batchId) {
        txTemplate().executeWithoutResult(status -> {
            ExamAiGradingBatch batch = batchRepository.findById(batchId).orElse(null);
            if (batch == null) {
                return;
            }
            recomputeBatchCountersInTx(batchId, null);
            batch = batchRepository.findById(batchId).orElse(null);
            if (batch == null) {
                return;
            }
            if (batch.getPendingCount() > 0 || batch.getProcessingCount() > 0) {
                return;
            }

            if (batch.getFailedCount() > 0 && batch.getCompletedCount() > 0) {
                batch.setStatus(AiGradingBatchStatus.PARTIAL_FAILED);
            } else if (batch.getFailedCount() > 0 && batch.getCompletedCount() == 0) {
                batch.setStatus(AiGradingBatchStatus.FAILED);
            } else {
                batch.setStatus(AiGradingBatchStatus.COMPLETED);
            }
            if (batch.getCompletedAt() == null) {
                batch.setCompletedAt(Instant.now());
            }

            if (!batch.isNotificationSent()) {
                sendBatchCompletionNotifications(batch);
                batch.setNotificationSent(true);
            }
            batchRepository.save(batch);
        });
    }

    private void sendBatchCompletionNotifications(ExamAiGradingBatch batch) {
        if (notificationService == null) {
            return;
        }
        Set<Long> recipients = new LinkedHashSet<>();
        if (batch.getTriggeredByUserId() != null) {
            recipients.add(batch.getTriggeredByUserId());
        }
        if (batch.getExamId() != null) {
            examRepository.findById(batch.getExamId()).ifPresent(exam -> {
                if (exam.getCreatedBy() != null) {
                    recipients.add(exam.getCreatedBy());
                }
                if (exam.getCourse() != null && exam.getCourse().getInstructorUser() != null
                        && exam.getCourse().getInstructorUser().getId() != null) {
                    recipients.add(exam.getCourse().getInstructorUser().getId());
                }
            });
        }
        if (recipients.isEmpty()) {
            return;
        }

        String examTitle = batch.getExamTitle() != null ? batch.getExamTitle() : ("Kỳ thi #" + batch.getExamId());
        String title = "AI đã hoàn thành chấm bài tự luận: " + examTitle;
        String message = String.format(
                "AI đã hoàn thành chấm bài tự luận cho kỳ thi %s. Tổng số bài: %d | AI chấm thành công: %d (chờ xác nhận) | Thất bại: %d. Vui lòng truy cập hệ thống để kiểm tra và xác nhận kết quả chấm.",
                examTitle,
                batch.getTotalAttempts(),
                batch.getCompletedCount(),
                batch.getFailedCount()
        );
        String targetUrl = batch.getExamId() != null
                ? "/exams/" + batch.getExamId() + "/grading?filter=AI_COMPLETED"
                : "/exams";

        for (Long recipientId : recipients) {
            String eventKey = "exam.ai.batch.completed." + batch.getId() + ".user." + recipientId;
            notificationService.createOnce(recipientId, eventKey, title, message, targetUrl);
        }
    }

    /**
     * 5. Khôi phục các Batch đang chạy dở khi Server khởi động lại (Restart Recovery).
     */
    @EventListener(ApplicationReadyEvent.class)
    public void recoverInterruptedBatches() {
        List<Long> interruptedBatchIds = txTemplate().execute(status -> {
            List<ExamAiGradingBatch> activeBatches = batchRepository.findByStatusIn(
                    List.of(AiGradingBatchStatus.PENDING, AiGradingBatchStatus.PROCESSING)
            );
            if (activeBatches.isEmpty()) {
                return List.<Long>of();
            }
            List<Long> ids = new ArrayList<>();
            for (ExamAiGradingBatch batch : activeBatches) {
                List<ExamAiGradingBatchItem> stuckItems = itemRepository.findByBatch_IdAndStatusInOrderByIdAsc(
                        batch.getId(),
                        List.of(AiEssayGradingState.PROCESSING)
                );
                for (ExamAiGradingBatchItem stuck : stuckItems) {
                    stuck.setStatus(AiEssayGradingState.PENDING);
                    itemRepository.save(stuck);
                    attemptRepository.findById(stuck.getAttemptId()).ifPresent(att -> {
                        if (att.getAiGradingState() == AiEssayGradingState.PROCESSING) {
                            att.setAiGradingState(AiEssayGradingState.PENDING);
                            attemptRepository.save(att);
                        }
                    });
                }
                recomputeBatchCountersInTx(batch.getId(), null);
                ids.add(batch.getId());
            }
            return ids;
        });

        if (interruptedBatchIds != null && !interruptedBatchIds.isEmpty()) {
            log.info("Recovering {} interrupted AI essay grading batch(es) after server start: {}",
                    interruptedBatchIds.size(), interruptedBatchIds);
            for (Long batchId : interruptedBatchIds) {
                dispatchBatchExecution(batchId);
            }
        }
    }

    /**
     * 6. Xem trạng thái tiến độ của Batch.
     */
    public EssayGradingDTO.BatchStatusDTO getBatchStatus(Long examId, Long batchId) {
        return readOnlyTxTemplate().execute(status -> {
            essayGradingService.requireExam(examId);
            ExamAiGradingBatch batch = batchRepository.findById(batchId)
                    .filter(b -> Objects.equals(b.getExamId(), examId))
                    .orElseThrow(() -> new ResourceNotFoundException("AI grading batch not found"));
            return toBatchStatusDTO(batch);
        });
    }

    public EssayGradingDTO.BatchStatusDTO getLatestBatchStatus(Long examId) {
        return readOnlyTxTemplate().execute(status -> {
            essayGradingService.requireExam(examId);
            return batchRepository.findFirstByExamIdOrderByCreatedAtDesc(examId)
                    .map(this::toBatchStatusDTO)
                    .orElse(null);
        });
    }

    /**
     * 7. Danh sách bài chờ giáo viên kiểm tra & xác nhận ("Chờ xác nhận AI"), hỗ trợ phân trang và lọc.
     */
    public Page<EssayGradingDTO.Summary> listReviewQueue(
            Long examId,
            String stateFilter,
            String search,
            Pageable pageable
    ) {
        return readOnlyTxTemplate().execute(status -> {
            essayGradingService.requireExam(examId);
            List<ExamAttempt> attempts = attemptRepository.findFinishedWithAnyQuestionType(
                    examId,
                    ExamEssayGradingService.SUBMITTED_STATES,
                    List.of(QuestionType.ESSAY, QuestionType.CODING)
            );

            String normalizedFilter = (stateFilter == null || stateFilter.isBlank() || "ALL".equalsIgnoreCase(stateFilter))
                    ? null
                    : stateFilter.trim().toUpperCase(Locale.ROOT);
            String normalizedSearch = (search == null || search.isBlank())
                    ? null
                    : search.trim().toLowerCase(Locale.ROOT);

            List<EssayGradingDTO.Summary> filtered = attempts.stream()
                    .map(essayGradingService::toSummary)
                    .filter(summary -> {
                        if (normalizedFilter != null) {
                            if ("UNGRADED".equals(normalizedFilter)) {
                                return summary.getAiGradingState() == null;
                            }
                            if ("LOW_SCORE_FLAGGED".equals(normalizedFilter)) {
                                return summary.isLowScoreFlagged();
                            }
                            if (!normalizedFilter.equalsIgnoreCase(summary.getAiGradingState())) {
                                return false;
                            }
                        }
                        if (normalizedSearch != null) {
                            String name = summary.getStudentName() != null ? summary.getStudentName().toLowerCase(Locale.ROOT) : "";
                            String email = summary.getStudentEmail() != null ? summary.getStudentEmail().toLowerCase(Locale.ROOT) : "";
                            String examTitle = summary.getExamTitle() != null ? summary.getExamTitle().toLowerCase(Locale.ROOT) : "";
                            return name.contains(normalizedSearch)
                                    || email.contains(normalizedSearch)
                                    || examTitle.contains(normalizedSearch)
                                    || String.valueOf(summary.getAttemptId()).contains(normalizedSearch);
                        }
                        return true;
                    })
                    .toList();

            int total = filtered.size();
            int start = (int) Math.min(pageable.getOffset(), total);
            int end = Math.min(start + pageable.getPageSize(), total);
            List<EssayGradingDTO.Summary> pageContent = filtered.subList(start, end);
            return new PageImpl<>(pageContent, pageable, total);
        });
    }

    /**
     * 8. Xác nhận hàng loạt kết quả AI chấm (Bulk Confirm / Apply All).
     * - Bắt buộc người chấm phải nhập đúng chuỗi xác nhận "APPLY ALL" để tránh bấm nhầm.
     * - Tuyệt đối KHÔNG tự động xác nhận các bài bị flag điểm quá thấp / Fail hoặc các bài chấm AI lỗi (FAILED).
     *   Những bài này buộc giáo viên phải mở kiểm tra từng bài và xác nhận thủ công.
     */
    public EssayGradingDTO.BulkConfirmResultDTO bulkConfirmAiGrades(
            Long examId,
            EssayGradingDTO.BulkConfirmRequest request
    ) {
        essayGradingService.requireExam(examId);
        String confirmText = request != null && request.getConfirmationText() != null
                ? request.getConfirmationText().trim()
                : "";
        if (!"APPLY ALL".equalsIgnoreCase(confirmText)) {
            throw new BadRequestException("Vui lòng nhập chính xác cụm từ 'APPLY ALL' để xác nhận áp dụng điểm cho tất cả bài hợp lệ.");
        }

        Set<Long> filterIds = (request.getAttemptIds() != null && !request.getAttemptIds().isEmpty())
                ? new HashSet<>(request.getAttemptIds())
                : null;

        return txTemplate().execute(status -> {
            List<ExamAttempt> allAttempts = attemptRepository.findAllByExam_Id(examId);
            allAttempts.sort(Comparator.comparing(ExamAttempt::getId));

            List<Long> confirmedIds = new ArrayList<>();
            List<Long> skippedLowScoreIds = new ArrayList<>();
            int skippedFailedCount = 0;

            for (ExamAttempt attempt : allAttempts) {
                if (filterIds != null && !filterIds.contains(attempt.getId())) {
                    continue;
                }
                if (!isSubmittedAttempt(attempt) || !hasAnsweredEssayQuestions(attempt) || isConfirmedOfficial(attempt)) {
                    continue;
                }
                String state = essayGradingService.resolveAiGradingState(attempt);
                if (AiEssayGradingState.FAILED.name().equals(state)) {
                    skippedFailedCount++;
                    skippedLowScoreIds.add(attempt.getId());
                    continue;
                }
                if (!AiEssayGradingState.AI_COMPLETED.name().equals(state)) {
                    continue;
                }
                if (essayGradingService.isLowScoreOrFailFlagged(attempt)) {
                    skippedLowScoreIds.add(attempt.getId());
                    continue;
                }

                essayGradingService.confirmAiDraftAsOfficialGrade(examId, attempt);
                confirmedIds.add(attempt.getId());
            }

            EssayGradingDTO.BulkConfirmResultDTO res = new EssayGradingDTO.BulkConfirmResultDTO();
            res.setExamId(examId);
            res.setConfirmedCount(confirmedIds.size());
            res.setSkippedLowScoreCount(skippedLowScoreIds.size());
            res.setSkippedFailedCount(skippedFailedCount);
            res.setConfirmedAttemptIds(confirmedIds);
            res.setSkippedLowScoreAttemptIds(skippedLowScoreIds);

            if (confirmedIds.isEmpty() && !skippedLowScoreIds.isEmpty()) {
                res.setMessage(String.format(
                        "Không có bài nào được xác nhận tự động. Đã giữ lại %d bài có điểm quá thấp / Fail để giáo viên trực tiếp kiểm tra và xác nhận.",
                        skippedLowScoreIds.size()
                ));
            } else if (!skippedLowScoreIds.isEmpty()) {
                res.setMessage(String.format(
                        "Đã xác nhận chính thức %d bài thi đạt yêu cầu. Đã giữ lại %d bài bị gắn cờ điểm thấp / Fail buộc giáo viên kiểm tra thủ công.",
                        confirmedIds.size(),
                        skippedLowScoreIds.size()
                ));
            } else {
                res.setMessage(String.format("Đã xác nhận điểm chính thức cho toàn bộ %d bài thi hoàn tất AI.", confirmedIds.size()));
            }
            return res;
        });
    }

    private EssayGradingDTO.BatchStatusDTO toBatchStatusDTO(ExamAiGradingBatch batch) {
        List<ExamAiGradingBatchItem> items = itemRepository.findByBatch_IdOrderByIdAsc(batch.getId());
        EssayGradingDTO.BatchStatusDTO dto = new EssayGradingDTO.BatchStatusDTO();
        dto.setBatchId(batch.getId());
        dto.setExamId(batch.getExamId());
        dto.setExamTitle(batch.getExamTitle());
        dto.setTriggeredByUserId(batch.getTriggeredByUserId());
        dto.setScope(batch.getScope());
        dto.setStatus(batch.getStatus().name());
        dto.setTotalAttempts(batch.getTotalAttempts());
        dto.setPendingCount(batch.getPendingCount());
        dto.setProcessingCount(batch.getProcessingCount());
        dto.setCompletedCount(batch.getCompletedCount());
        dto.setFailedCount(batch.getFailedCount());
        dto.setSkippedCount(batch.getSkippedCount());

        int total = batch.getTotalAttempts();
        int finished = batch.getCompletedCount() + batch.getFailedCount() + batch.getSkippedCount();
        double percent = total == 0 ? 100.0 : Math.min(100.0, Math.round((finished * 1000.0) / total) / 10.0);
        dto.setProgressPercent(percent);
        dto.setNotificationSent(batch.isNotificationSent());
        dto.setStartedAt(batch.getStartedAt());
        dto.setCompletedAt(batch.getCompletedAt());
        dto.setLastError(batch.getLastError());

        List<EssayGradingDTO.BatchItemDTO> itemDtos = items.stream().map(it -> {
            EssayGradingDTO.BatchItemDTO itemDto = new EssayGradingDTO.BatchItemDTO();
            itemDto.setItemId(it.getId());
            itemDto.setAttemptId(it.getAttemptId());
            itemDto.setExamId(it.getExamId());
            itemDto.setStudentId(it.getStudentId());
            itemDto.setStudentName(it.getStudentName());
            itemDto.setStatus(it.getStatus() != null ? it.getStatus().name() : null);
            itemDto.setRetryCount(it.getRetryCount());
            itemDto.setEssayCount(it.getEssayCount());
            itemDto.setAiGradedEssayCount(it.getAiGradedEssayCount());
            itemDto.setProposedTotalEssayScore(it.getProposedTotalEssayScore());
            itemDto.setErrorMessage(it.getErrorMessage());
            itemDto.setStartedAt(it.getStartedAt());
            itemDto.setFinishedAt(it.getFinishedAt());
            return itemDto;
        }).toList();
        dto.setItems(itemDtos);
        return dto;
    }

    private boolean isSubmittedAttempt(ExamAttempt attempt) {
        return attempt != null && ExamEssayGradingService.SUBMITTED_STATES.contains(attempt.getStatus());
    }

    private boolean isConfirmedOfficial(ExamAttempt attempt) {
        if (attempt == null) return false;
        if (attempt.getAiGradingState() == AiEssayGradingState.CONFIRMED) {
            return true;
        }
        return attempt.getFinalScore() != null && attempt.getStatus() == ExamAttemptStatus.SUBMITTED;
    }

    private boolean hasAnsweredEssayQuestions(ExamAttempt attempt) {
        if (attempt == null || attempt.getQuestions() == null) return false;
        List<ExamAttemptQuestion> essays = attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.ESSAY)
                .toList();
        if (essays.isEmpty()) {
            return false;
        }
        for (ExamAttemptQuestion q : essays) {
            ExamAttemptAnswer ans = attempt.getAnswers().stream()
                    .filter(a -> a.getQuestion() != null && Objects.equals(a.getQuestion().getId(), q.getId()))
                    .findFirst()
                    .orElse(null);
            if (ans != null && ans.getTextAnswer() != null && !ans.getTextAnswer().isBlank()) {
                return true;
            }
        }
        return false;
    }

    private String normalizeScope(String rawScope) {
        if (rawScope == null || rawScope.isBlank()) {
            return SCOPE_UNGRADED_ONLY;
        }
        String upper = rawScope.trim().toUpperCase(Locale.ROOT);
        return switch (upper) {
            case SCOPE_FAILED_ONLY, "RETRY_FAILED" -> SCOPE_FAILED_ONLY;
            case SCOPE_ALL_ELIGIBLE, "ALL" -> SCOPE_ALL_ELIGIBLE;
            default -> SCOPE_UNGRADED_ONLY;
        };
    }

    private String fullName(User student) {
        if (student == null) return "";
        String first = student.getFirstName() != null ? student.getFirstName().trim() : "";
        String last = student.getLastName() != null ? student.getLastName().trim() : "";
        return (first + " " + last).trim();
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return null;
        return s.length() <= maxLen ? s : s.substring(0, maxLen);
    }
}
