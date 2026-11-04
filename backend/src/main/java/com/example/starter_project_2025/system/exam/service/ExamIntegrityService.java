package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.AttemptIntegritySummary;
import com.example.starter_project_2025.system.exam.dto.ExamIntegrityReportDTO;
import com.example.starter_project_2025.system.exam.dto.IntegrityEventRequest;
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
    /** Toi da so anh bang chung camera cho 1 luot thi (tranh phinh database). */
    static final int MAX_EVIDENCE_PER_ATTEMPT = 40;
    static final String IMAGE_PREFIX = "data:image/jpeg;base64,";
    /** Neu tab cu con "song" (heartbeat) trong khoang nay thi coi la dang mo song song. */
    static final Duration SESSION_ALIVE_WINDOW = Duration.ofSeconds(45);

    private final ExamAttemptRepository attemptRepository;
    private final ExamRepository examRepository;
    private final ExamIntegrityEventRepository eventRepository;
    private final ExamProctorImageRepository proctorImageRepository;

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
        Map<ExamIntegrityEvent, String> snapshots = new IdentityHashMap<>();

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
                // su kien camera duoc gui khi ket thuc vi pham -> lui thoi diem ve luc bat dau
                Instant at = isCameraType(item.getType()) && dur != null ? now.minusSeconds(dur) : now;
                ExamIntegrityEvent ev = build(attempt, item.getType(), at, dur, item.getDetail(), userAgent, ip);
                toSave.add(ev);
                if (isCameraType(item.getType()) && validImage(item.getSnapshot())) {
                    snapshots.put(ev, item.getSnapshot());
                }
            }
        }
        long evidence = proctorImageRepository.countByAttemptIdAndEventIdIsNotNull(attemptId);
        for (ExamIntegrityEvent e : toSave) {
            if (existing++ >= MAX_EVENTS_PER_ATTEMPT) break;
            eventRepository.save(e);
            String snap = snapshots.get(e);
            if (snap != null && evidence < MAX_EVIDENCE_PER_ATTEMPT) {
                saveImage(attempt, e.getId(), now, snap);
                evidence++;
            }
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
            case CAMERA_OFF, CAMERA_COVERED, FACE_MISSING, MULTIPLE_FACES ->
                    Boolean.TRUE.equals(exam.getCameraProctoring());
        };
    }

    static boolean isCameraType(IntegrityEventType type) {
        return type == IntegrityEventType.CAMERA_OFF || type == IntegrityEventType.CAMERA_COVERED
                || type == IntegrityEventType.FACE_MISSING || type == IntegrityEventType.MULTIPLE_FACES;
    }

    static boolean validImage(String data) {
        return data != null && data.startsWith(IMAGE_PREFIX) && data.length() > IMAGE_PREFIX.length()
                && data.length() <= 400_000;
    }

    private void saveImage(ExamAttempt attempt, Long eventId, Instant at, String imageData) {
        ExamProctorImage img = new ExamProctorImage();
        img.setAttemptId(attempt.getId());
        img.setExamId(attempt.getExam().getId());
        img.setEventId(eventId);
        img.setCapturedAt(at);
        img.setImageData(imageData);
        proctorImageRepository.save(img);
    }

    // ------------------------------------------------------------------ anh luc vao thi

    /** Luu anh chup nguoi thi luc vao thi (chi luu 1 lan cho moi luot thi). */
    @Transactional
    public void saveEntryPhoto(Long attemptId, Long studentId, String imageData) {
        ExamAttempt attempt = attemptRepository.lockByIdAndStudentId(attemptId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        Exam exam = attempt.getExam();
        if (!Boolean.TRUE.equals(exam.getAntiCheatEnabled()) || !Boolean.TRUE.equals(exam.getCameraProctoring())) {
            return;
        }
        if (attempt.getStatus() != ExamAttemptStatus.IN_PROGRESS) return;
        if (!validImage(imageData)) {
            throw new IllegalArgumentException("Invalid photo");
        }
        if (proctorImageRepository.existsByAttemptIdAndEventIdIsNull(attemptId)) return;
        saveImage(attempt, null, Instant.now(), imageData);
    }

    @Transactional(readOnly = true)
    public ExamIntegrityReportDTO.EntryPhotoDTO getEntryPhoto(Long examId, Long attemptId) {
        ExamAttempt a = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        if (!a.getExam().getId().equals(examId)) {
            throw new ResourceNotFoundException("Exam attempt not found");
        }
        ExamIntegrityReportDTO.EntryPhotoDTO dto = new ExamIntegrityReportDTO.EntryPhotoDTO();
        proctorImageRepository.findFirstByAttemptIdAndEventIdIsNullOrderByCapturedAtAsc(attemptId)
                .ifPresent(i -> {
                    dto.setImageData(i.getImageData());
                    dto.setCapturedAt(i.getCapturedAt());
                });
        return dto;
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
        Set<Long> withPhoto = new HashSet<>(proctorImageRepository.findAttemptIdsWithEntryPhoto(examId));
        Map<Long, List<ExamIntegrityEvent>> byAttempt = new HashMap<>();
        for (ExamIntegrityEvent e : eventRepository.findAllByExamIdOrderByOccurredAtAsc(examId)) {
            byAttempt.computeIfAbsent(e.getAttemptId(), k -> new ArrayList<>()).add(e);
        }

        ExamIntegrityReportDTO dto = new ExamIntegrityReportDTO();
        dto.setExamId(examId);
        dto.setExamTitle(exam.getTitle());
        dto.setAntiCheatEnabled(Boolean.TRUE.equals(exam.getAntiCheatEnabled()));

        Map<String, Integer> totals = new LinkedHashMap<>();
        for (IntegrityEventType t : IntegrityEventType.values()) totals.put(t.name(), 0);

        List<ExamIntegrityReportDTO.Row> rows = new ArrayList<>();
        int flagged = 0, totalViolations = 0;

        List<ExamAttempt> sorted = new ArrayList<>(attempts);
        sorted.sort(Comparator.comparing((ExamAttempt a) -> a.getStudent().getFullName(),
                        String.CASE_INSENSITIVE_ORDER)
                .thenComparingInt(ExamAttempt::getAttemptNumber));

        for (ExamAttempt a : sorted) {
            List<ExamIntegrityEvent> events = byAttempt.getOrDefault(a.getId(), List.of());
            ExamIntegrityReportDTO.Row r = toRow(a, events);
            r.setHasEntryPhoto(withPhoto.contains(a.getId()));
            for (ExamIntegrityEvent e : events) totals.merge(e.getType().name(), 1, Integer::sum);
            if (r.isFlagged()) flagged++;
            totalViolations += r.getTotalViolations();
            rows.add(r);
        }
        // bi gan co len dau, sau do nhieu vi pham nhat
        rows.sort((x, y) -> {
            int c = Boolean.compare(y.isFlagged(), x.isFlagged());
            return c != 0 ? c : Integer.compare(y.getTotalViolations(), x.getTotalViolations());
        });

        dto.setTotalAttempts(attempts.size());
        dto.setFlaggedAttempts(flagged);
        dto.setTotalViolations(totalViolations);
        dto.setTotalsByType(totals);
        dto.setRows(rows);
        return dto;
    }

    static ExamIntegrityReportDTO.Row toRow(ExamAttempt a, List<ExamIntegrityEvent> events) {
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

        applyCounts(r, events);
        if (a.getStartedAt() != null && a.getSubmittedAt() != null) {
            r.setDurationSeconds(Math.max(0, Duration.between(a.getStartedAt(), a.getSubmittedAt()).getSeconds()));
        }
        return r;
    }

    /**
     * Dem cac loai vi pham cua 1 luot thi. Dung chung cho bao cao va cho
     * tom tat trang thai gian lan.
     */
    static void applyCounts(ExamIntegrityReportDTO.Row r, List<ExamIntegrityEvent> events) {
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
                case CAMERA_OFF -> r.setCameraOffCount(r.getCameraOffCount() + 1);
                case CAMERA_COVERED -> r.setCameraCoveredCount(r.getCameraCoveredCount() + 1);
                case FACE_MISSING -> r.setFaceMissingCount(r.getFaceMissingCount() + 1);
                case MULTIPLE_FACES -> r.setMultipleFacesCount(r.getMultipleFacesCount() + 1);
            }
            if (e.getDurationSeconds() != null) away += e.getDurationSeconds();
            if (last == null || e.getOccurredAt().isAfter(last)) last = e.getOccurredAt();
        }
        r.setTotalViolations(events.size());
        r.setTotalAwaySeconds(away);
        r.setLastViolationAt(last);
        // CHANGED: chi con 1 co duy nhat: luot thi co it nhat 1 vi pham thi bi gan co.
        // Co nay dung de sau nay lam tinh nang sua diem sinh vien bi gan co.
        r.setFlagged(!events.isEmpty());
    }

    /**
     * Tom tat trang thai gian lan cua 1 luot thi: co bi gan co hay khong va
     * so luong vi pham theo tung loai.
     */
    @Transactional(readOnly = true)
    public AttemptIntegritySummary summarize(Long attemptId) {
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        List<ExamIntegrityEvent> events =
                eventRepository.findAllByAttemptIdOrderByOccurredAtAsc(attemptId);

        ExamIntegrityReportDTO.Row counter = new ExamIntegrityReportDTO.Row();
        applyCounts(counter, events);

        AttemptIntegritySummary summary = new AttemptIntegritySummary();
        summary.setFlagged(counter.isFlagged());
        summary.setTotalViolations(counter.getTotalViolations());
        summary.setTabSwitchCount(counter.getTabSwitchCount());
        summary.setCopyPasteCount(counter.getCopyPasteCount());
        summary.setFullscreenExitCount(counter.getFullscreenExitCount());
        summary.setShortcutCount(counter.getShortcutCount());
        summary.setMultiSessionCount(counter.getMultiSessionCount());
        summary.setWindowBlurCount(counter.getWindowBlurCount());
        summary.setContextMenuCount(counter.getContextMenuCount());
        summary.setTotalAwaySeconds(counter.getTotalAwaySeconds());
        summary.setLastViolationAt(counter.getLastViolationAt());
        summary.setAntiCheatEnabled(
                Boolean.TRUE.equals(attempt.getExam().getAntiCheatEnabled()));
        return summary;
    }

    @Transactional(readOnly = true)
    public List<ExamIntegrityReportDTO.EventDTO> getEvents(Long examId, Long attemptId) {
        ExamAttempt a = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        if (!a.getExam().getId().equals(examId)) {
            throw new ResourceNotFoundException("Exam attempt not found");
        }
        List<ExamIntegrityReportDTO.EventDTO> out = new ArrayList<>();
        List<ExamIntegrityEvent> list = eventRepository.findAllByAttemptIdOrderByOccurredAtAsc(attemptId);
        Map<Long, String> snaps = new HashMap<>();
        if (!list.isEmpty()) {
            for (ExamProctorImage i : proctorImageRepository.findAllByEventIdIn(
                    list.stream().map(ExamIntegrityEvent::getId).toList())) {
                snaps.put(i.getEventId(), i.getImageData());
            }
        }
        for (ExamIntegrityEvent e : list) {
            ExamIntegrityReportDTO.EventDTO d = new ExamIntegrityReportDTO.EventDTO();
            d.setId(e.getId());
            d.setType(e.getType().name());
            d.setOccurredAt(e.getOccurredAt());
            d.setDurationSeconds(e.getDurationSeconds());
            d.setDetail(e.getDetail());
            d.setUserAgent(e.getUserAgent());
            d.setIpAddress(e.getIpAddress());
            d.setSnapshot(snaps.get(e.getId()));
            out.add(d);
        }
        return out;
    }
}
