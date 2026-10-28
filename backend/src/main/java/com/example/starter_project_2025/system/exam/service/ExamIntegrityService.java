package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.ExamIntegrityReportDTO;
import com.example.starter_project_2025.system.exam.dto.IntegrityEventRequest;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * NEW (anti-cheat): ghi nhan va tong hop vi pham. Chi GHI LOG, khong tu dong nop bai / khoa bai.
 */
@Service
@RequiredArgsConstructor
public class ExamIntegrityService {

    /** Gioi han chong spam: toi da so su kien cho 1 luot thi. */
    static final int MAX_EVENTS_PER_ATTEMPT = 2000;
    /** Neu tab cu con "song" (heartbeat) trong khoang nay thi coi la dang mo song song. */
    static final Duration SESSION_ALIVE_WINDOW = Duration.ofSeconds(45);

    private final ExamAttemptRepository attemptRepository;
    private final ExamRepository examRepository;
    private final ExamIntegrityEventRepository eventRepository;
    private final ExamIntegrityReviewRepository reviewRepository; // NEW (anti-cheat nang cao)

    // ------------------------------------------------------------------ ghi nhan

    @Transactional
    public void record(Long attemptId, Long studentId, IntegrityEventRequest request,
                       String userAgent, String ip) {
        ExamAttempt attempt = attemptRepository.lockByIdAndStudentId(attemptId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        Exam exam = attempt.getExam();
        if (!Boolean.TRUE.equals(exam.getAntiCheatEnabled())) return;
        if (attempt.getStatus() != ExamAttemptStatus.IN_PROGRESS) return;

        Instant now = Instant.now();
        List<ExamIntegrityEvent> toSave = new ArrayList<>();

        // --- phat hien nhieu tab / thiet bi (heartbeat) ---
        String clientId = request.getClientId();
        if (Boolean.TRUE.equals(exam.getSingleSession()) && clientId != null && !clientId.isBlank()) {
            String last = attempt.getLastClientId();
            Instant seen = attempt.getLastClientSeenAt();
            if (last != null && !last.equals(clientId) && seen != null
                    && Duration.between(seen, now).compareTo(SESSION_ALIVE_WINDOW) < 0) {
                toSave.add(build(attempt, IntegrityEventType.MULTI_SESSION, now, null,
                        "Bai thi dang duoc mo o noi khac", userAgent, ip));
            }
            attempt.setLastClientId(clientId);
            attempt.setLastClientSeenAt(now);
            attemptRepository.save(attempt);
        }

        long existing = eventRepository.countByAttemptId(attemptId);
        if (request.getEvents() != null) {
            for (IntegrityEventRequest.Item item : request.getEvents()) {
                if (!isEnabled(exam, item.getType())) continue;
                Integer dur = item.getDurationSeconds() == null ? null
                        : Math.max(0, Math.min(item.getDurationSeconds(), 24 * 3600));
                toSave.add(build(attempt, item.getType(), now, dur, item.getDetail(), userAgent, ip));
            }
        }
        for (ExamIntegrityEvent e : toSave) {
            if (existing++ >= MAX_EVENTS_PER_ATTEMPT) break;
            eventRepository.save(e);
        }
    }

    /** Chi ghi loai su kien nao giao vien da bat cho de thi nay. */
    static boolean isEnabled(Exam exam, IntegrityEventType type) {
        if (type == null) return false;
        return switch (type) {
            case TAB_HIDDEN, WINDOW_BLUR -> Boolean.TRUE.equals(exam.getDetectTabSwitch());
            case FULLSCREEN_EXIT -> Boolean.TRUE.equals(exam.getRequireFullscreen());
            case COPY, CUT, PASTE, CONTEXT_MENU, DEVTOOLS_KEY, PRINT_ATTEMPT ->
                    Boolean.TRUE.equals(exam.getBlockCopyPaste());
            case MULTI_SESSION -> Boolean.TRUE.equals(exam.getSingleSession());
        };
    }

    private ExamIntegrityEvent build(ExamAttempt a, IntegrityEventType type, Instant at,
                                     Integer dur, String detail, String ua, String ip) {
        ExamIntegrityEvent e = new ExamIntegrityEvent();
        e.setAttemptId(a.getId());
        e.setExamId(a.getExam().getId());
        e.setStudentId(a.getStudent().getId());
        e.setType(type);
        e.setOccurredAt(at);
        e.setDurationSeconds(dur);
        e.setDetail(detail);
        e.setUserAgent(ua == null ? null : ua.substring(0, Math.min(ua.length(), 300)));
        e.setIpAddress(ip);
        return e;
    }

    // ------------------------------------------------------------------ bao cao

    @Transactional(readOnly = true)
    public ExamIntegrityReportDTO getReport(Long examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
        List<ExamAttempt> attempts = attemptRepository.findAllByExam_Id(examId);
        Map<Long, List<ExamIntegrityEvent>> byAttempt = new HashMap<>();
        for (ExamIntegrityEvent e : eventRepository.findAllByExamIdOrderByOccurredAtAsc(examId)) {
            byAttempt.computeIfAbsent(e.getAttemptId(), k -> new ArrayList<>()).add(e);
        }
        Integer threshold = exam.getFlagThreshold();

        ExamIntegrityReportDTO dto = new ExamIntegrityReportDTO();
        dto.setExamId(examId);
        dto.setExamTitle(exam.getTitle());
        dto.setAntiCheatEnabled(Boolean.TRUE.equals(exam.getAntiCheatEnabled()));
        dto.setFlagThreshold(threshold);

        Map<String, Integer> totals = new LinkedHashMap<>();
        for (IntegrityEventType t : IntegrityEventType.values()) totals.put(t.name(), 0);

        List<ExamIntegrityReportDTO.Row> rows = new ArrayList<>();
        int withViolations = 0, flagged = 0, totalViolations = 0;

        // NEW (anti-cheat nang cao): do giong nhau tu luan + ket qua xem xet
        Map<Long, SimilarMatch> similarity = exam.getSimilarityPercent() == null
                ? Map.of() : computeSimilarity(attempts, exam.getSimilarityPercent());
        Map<Long, ExamIntegrityReview> reviews = new HashMap<>();
        for (ExamIntegrityReview rv : reviewRepository.findAllByExamId(examId)) reviews.put(rv.getAttemptId(), rv);
        int pendingFlagged = 0, reviewedNormal = 0, reviewedSuspicious = 0, tooFastCount = 0, similarCount = 0;

        List<ExamAttempt> sorted = new ArrayList<>(attempts);
        sorted.sort(Comparator.comparing((ExamAttempt a) -> a.getStudent().getFullName(),
                        String.CASE_INSENSITIVE_ORDER)
                .thenComparingInt(ExamAttempt::getAttemptNumber));

        for (ExamAttempt a : sorted) {
            List<ExamIntegrityEvent> events = byAttempt.getOrDefault(a.getId(), List.of());
            ExamIntegrityReportDTO.Row r = toRow(a, events, threshold);
            enrich(r, a, exam, similarity.get(a.getId()), reviews.get(a.getId()));
            if (r.isTooFast()) tooFastCount++;
            if (r.getMaxSimilarityPercent() != null) similarCount++;
            if (r.getReviewStatus() == IntegrityReviewStatus.REVIEWED_NORMAL) reviewedNormal++;
            else if (r.getReviewStatus() == IntegrityReviewStatus.REVIEWED_SUSPICIOUS) reviewedSuspicious++;
            else if (r.isFlagged()) pendingFlagged++;
            for (ExamIntegrityEvent e : events) totals.merge(e.getType().name(), 1, Integer::sum);
            if (r.getTotalViolations() > 0) withViolations++;
            if (r.isFlagged()) flagged++;
            totalViolations += r.getTotalViolations();
            rows.add(r);
        }
        // bi gan co len dau, sau do nhieu vi pham nhat
        rows.sort((x, y) -> {
            int c = Boolean.compare(y.isFlagged(), x.isFlagged());
            return c != 0 ? c : Integer.compare(y.getTotalViolations(), x.getTotalViolations());
        });
        dto.setFastSubmitPercent(exam.getFastSubmitPercent());
        dto.setSimilarityPercent(exam.getSimilarityPercent());
        dto.setPendingReviewFlagged(pendingFlagged);
        dto.setReviewedNormal(reviewedNormal);
        dto.setReviewedSuspicious(reviewedSuspicious);
        dto.setTooFastCount(tooFastCount);
        dto.setSimilarCount(similarCount);

        dto.setTotalAttempts(attempts.size());
        dto.setAttemptsWithViolations(withViolations);
        dto.setFlaggedAttempts(flagged);
        dto.setTotalViolations(totalViolations);
        dto.setTotalsByType(totals);
        dto.setRows(rows);
        return dto;
    }

    static ExamIntegrityReportDTO.Row toRow(ExamAttempt a, List<ExamIntegrityEvent> events, Integer threshold) {
        User s = a.getStudent();
        ExamIntegrityReportDTO.Row r = new ExamIntegrityReportDTO.Row();
        r.setStudentId(s.getId());
        r.setStudentName(s.getFullName());
        r.setEmail(s.getEmail());
        r.setUsername(s.getUsername());
        r.setEmployeeCode(s.getEmployeeCode());
        r.setPhone(s.getPhone());
        r.setDescription(s.getDescription());
        r.setGuest(Boolean.TRUE.equals(s.getIsGuest()));
        r.setAttemptId(a.getId());
        r.setAttemptNumber(a.getAttemptNumber());
        r.setStatus(a.getStatus());
        r.setStartedAt(a.getStartedAt());
        r.setSubmittedAt(a.getSubmittedAt());
        r.setObjectiveScore(a.getObjectiveScore());
        r.setFinalScore(a.getFinalScore());
        r.setMaxScore(ExamScoring.effectiveMax(a.getMaxScore()));

        int away = 0;
        Instant last = null;
        for (ExamIntegrityEvent e : events) {
            switch (e.getType()) {
                case TAB_HIDDEN -> r.setTabSwitchCount(r.getTabSwitchCount() + 1);
                case WINDOW_BLUR -> r.setWindowBlurCount(r.getWindowBlurCount() + 1);
                case FULLSCREEN_EXIT -> r.setFullscreenExitCount(r.getFullscreenExitCount() + 1);
                case COPY, CUT, PASTE -> r.setCopyPasteCount(r.getCopyPasteCount() + 1);
                case CONTEXT_MENU -> r.setContextMenuCount(r.getContextMenuCount() + 1);
                case DEVTOOLS_KEY, PRINT_ATTEMPT -> r.setShortcutCount(r.getShortcutCount() + 1);
                case MULTI_SESSION -> r.setMultiSessionCount(r.getMultiSessionCount() + 1);
            }
            if (e.getDurationSeconds() != null) away += e.getDurationSeconds();
            if (last == null || e.getOccurredAt().isAfter(last)) last = e.getOccurredAt();
        }
        r.setTotalViolations(events.size());
        r.setTotalAwaySeconds(away);
        r.setLastViolationAt(last);
        boolean many = threshold != null && threshold > 0 && events.size() >= threshold;
        if (many) r.getFlagReasons().add("MANY_VIOLATIONS");
        r.setFlagged(many);
        return r;
    }

    // ------------------------------------------------------------------ co nang cao (NEW)

    private record SimilarMatch(double score, Long otherAttemptId, String otherStudentName) {}

    /** Chi so sanh neu so luot thi cung 1 cau khong qua lon (tranh O(n^2) qua nang). */
    static final int MAX_ATTEMPTS_PER_QUESTION = 400;

    /** Tim, voi moi luot thi, luot khac (khac sinh vien) co tu luan giong nhat >= nguong. */
    private Map<Long, SimilarMatch> computeSimilarity(List<ExamAttempt> attempts, int thresholdPercent) {
        record Entry(ExamAttempt attempt, Set<String> shingles) {}
        Map<Long, List<Entry>> byQuestion = new HashMap<>();
        for (ExamAttempt a : attempts) {
            if (a.getStatus() == ExamAttemptStatus.IN_PROGRESS || a.getStatus() == ExamAttemptStatus.NOT_STARTED) continue;
            for (ExamAttemptAnswer ans : a.getAnswers()) {
                ExamAttemptQuestion q = ans.getQuestion();
                if (q.getType() != QuestionType.ESSAY) continue;
                Set<String> sh = TextSimilarity.shingles(ans.getTextAnswer());
                if (sh.isEmpty()) continue;
                Long key = q.getSourceQuestionId() != null ? q.getSourceQuestionId() : q.getId();
                byQuestion.computeIfAbsent(key, k -> new ArrayList<>()).add(new Entry(a, sh));
            }
        }
        Map<Long, SimilarMatch> best = new HashMap<>();
        for (List<Entry> list : byQuestion.values()) {
            if (list.size() > MAX_ATTEMPTS_PER_QUESTION) continue;
            for (int i = 0; i < list.size(); i++) {
                for (int j = i + 1; j < list.size(); j++) {
                    ExamAttempt x = list.get(i).attempt(), y = list.get(j).attempt();
                    if (x.getStudent().getId().equals(y.getStudent().getId())) continue;
                    double s = TextSimilarity.jaccard(list.get(i).shingles(), list.get(j).shingles());
                    if (s * 100 < thresholdPercent) continue;
                    keepBest(best, x, y, s);
                    keepBest(best, y, x, s);
                }
            }
        }
        return best;
    }

    private static void keepBest(Map<Long, SimilarMatch> best, ExamAttempt self, ExamAttempt other, double score) {
        SimilarMatch cur = best.get(self.getId());
        if (cur == null || score > cur.score()) {
            best.put(self.getId(), new SimilarMatch(score, other.getId(), other.getStudent().getFullName()));
        }
    }

    /** Bo sung: thoi luong, co nop nhanh, co noi dung trung, ket qua xem xet. */
    private static void enrich(ExamIntegrityReportDTO.Row r, ExamAttempt a, Exam exam,
                               SimilarMatch match, ExamIntegrityReview review) {
        if (a.getStartedAt() != null && a.getSubmittedAt() != null) {
            long secs = Math.max(0, Duration.between(a.getStartedAt(), a.getSubmittedAt()).getSeconds());
            r.setDurationSeconds(secs);
            Integer pct = exam.getFastSubmitPercent();
            long limit = a.getDurationMinutes() * 60L;
            boolean userSubmitted = a.getStatus() == ExamAttemptStatus.SUBMITTED
                    || a.getStatus() == ExamAttemptStatus.PENDING_REVIEW;
            if (pct != null && pct > 0 && userSubmitted && limit > 0 && secs * 100 < limit * pct) {
                r.setTooFast(true);
                r.getFlagReasons().add("TOO_FAST");
            }
        }
        if (match != null) {
            r.setMaxSimilarityPercent((int) Math.round(match.score() * 100));
            r.setSimilarAttemptId(match.otherAttemptId());
            r.setSimilarStudentName(match.otherStudentName());
            r.getFlagReasons().add("SIMILAR_CONTENT");
        }
        r.setFlagged(!r.getFlagReasons().isEmpty());
        if (review != null) {
            r.setReviewStatus(review.getStatus());
            r.setReviewedBy(review.getReviewerName());
            r.setReviewedAt(review.getReviewedAt());
            r.setReviewNote(review.getNote());
        }
    }

    // ------------------------------------------------------------------ reviewer xem xet (NEW)

    @Transactional
    public void review(Long examId, Long attemptId, com.example.starter_project_2025.system.exam.dto.IntegrityReviewRequest req,
                       Long reviewerId, String reviewerName) {
        ExamAttempt a = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        if (!a.getExam().getId().equals(examId)) {
            throw new ResourceNotFoundException("Exam attempt not found");
        }
        Optional<ExamIntegrityReview> existing = reviewRepository.findByAttemptId(attemptId);
        if (req.getStatus() == IntegrityReviewStatus.NOT_REVIEWED) {
            existing.ifPresent(reviewRepository::delete);
            return;
        }
        ExamIntegrityReview rv = existing.orElseGet(ExamIntegrityReview::new);
        rv.setAttemptId(attemptId);
        rv.setExamId(examId);
        rv.setStatus(req.getStatus());
        String note = req.getNote() == null ? null : req.getNote().trim();
        rv.setNote(note == null || note.isEmpty() ? null : note);
        rv.setReviewerId(reviewerId);
        rv.setReviewerName(reviewerName);
        rv.setReviewedAt(Instant.now());
        reviewRepository.save(rv);
    }

    @Transactional(readOnly = true)
    public List<ExamIntegrityReportDTO.EventDTO> getEvents(Long examId, Long attemptId) {
        ExamAttempt a = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        if (!a.getExam().getId().equals(examId)) {
            throw new ResourceNotFoundException("Exam attempt not found");
        }
        List<ExamIntegrityReportDTO.EventDTO> out = new ArrayList<>();
        for (ExamIntegrityEvent e : eventRepository.findAllByAttemptIdOrderByOccurredAtAsc(attemptId)) {
            ExamIntegrityReportDTO.EventDTO d = new ExamIntegrityReportDTO.EventDTO();
            d.setId(e.getId());
            d.setType(e.getType().name());
            d.setOccurredAt(e.getOccurredAt());
            d.setDurationSeconds(e.getDurationSeconds());
            d.setDetail(e.getDetail());
            d.setUserAgent(e.getUserAgent());
            d.setIpAddress(e.getIpAddress());
            out.add(d);
        }
        return out;
    }
}
