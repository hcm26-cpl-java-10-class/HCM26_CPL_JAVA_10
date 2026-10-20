package com.example.starter_project_2025.system.schedule.session_audit;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionAccessPolicy;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.example.starter_project_2025.system.schedule.session_audit.dto.AuditLogQuery;
import com.example.starter_project_2025.system.schedule.session_audit.dto.AuditLogResponse;
import com.example.starter_project_2025.system.schedule.session_audit.dto.SessionNotesUpdateResponse;
import com.example.starter_project_2025.system.schedule.session_audit.dto.SessionStatusHistoryResponse;
import com.example.starter_project_2025.system.schedule.session_audit.dto.UpdateSessionNotesRequest;
import com.example.starter_project_2025.system.schedule.session_audit.entity.SessionAuditIdempotencyRecord;
import com.example.starter_project_2025.system.schedule.session_audit.entity.SessionAuditLog;
import com.example.starter_project_2025.system.schedule.session_audit.entity.SessionStatusHistory;
import com.example.starter_project_2025.system.schedule.session_audit.exception.SessionAuditConflictException;
import com.example.starter_project_2025.system.schedule.session_audit.exception.SessionAuditValidationException;
import com.example.starter_project_2025.system.schedule.session_audit.exception.SessionNotFoundException;
import com.example.starter_project_2025.system.schedule.session_audit.repository.SessionAuditIdempotencyRepository;
import com.example.starter_project_2025.system.schedule.session_audit.repository.SessionAuditLogRepository;
import com.example.starter_project_2025.system.schedule.session_audit.repository.SessionStatusHistoryRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * T2 / US-F15-02 — Cập nhật notes và audit thông tin người cập nhật/thời điểm.
 *
 * <p>Luồng xử lý chính ({@link #updateNotes}):</p>
 * <ol>
 *     <li>Chặn client gửi {@code updatedBy}/{@code updatedAt} (server-set) → 422.</li>
 *     <li>Idempotency: cùng {@code Idempotency-Key} ⇒ trả kết quả cũ, không sinh thêm history/audit.</li>
 *     <li>Kiểm tra quyền (Trainer được phân công / Class Admin) + optimistic version.</li>
 *     <li>Chuyển trạng thái (nếu có) → INSERT 1 dòng {@code session_status_history}.</li>
 *     <li>Ghi audit log (actor, before/after, reason, correlation ID) và set {@code updatedBy}/{@code updatedAt}.</li>
 * </ol>
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionAuditServiceImpl implements SessionAuditService {

    /** OD-F15-03 — notes tối đa 2000 ký tự. */
    static final int MAX_NOTES_LENGTH = 2000;
    static final int MAX_REASON_LENGTH = 500;
    static final int MAX_IDEMPOTENCY_KEY_LENGTH = 120;
    static final int DEFAULT_PAGE_SIZE = 20;
    static final int MAX_PAGE_SIZE = 200;
    static final int MAX_EXPORT_ROWS = 5000;
    static final String ENTITY_TYPE_SESSION = "SESSION";

    SessionRepository sessionRepository;
    SessionAccessPolicy sessionAccessPolicy;
    SessionStatusHistoryRepository historyRepository;
    SessionAuditLogRepository auditLogRepository;
    SessionAuditIdempotencyRepository idempotencyRepository;
    SessionAuditMapper mapper;
    ObjectMapper objectMapper;

    // ------------------------------------------------------------------ write

    @Override
    public SessionNotesUpdateResponse updateNotes(Long sessionId,
                                                 UpdateSessionNotesRequest request,
                                                 Long expectedVersion,
                                                 String idempotencyKey) {

        if (sessionId == null || sessionId <= 0) {
            throw SessionAuditValidationException.of("id", "Session ID phải là số dương.");
        }

        UpdateSessionNotesRequest payload = request != null ? request : new UpdateSessionNotesRequest();
        rejectClientSuppliedAuditFields(payload);

        String notes = normalizeNotes(payload.getNotes());
        String reason = normalizeReason(payload.getReason());

        if (payload.getStatus() == null && payload.getNotes() == null) {
            throw SessionAuditValidationException.of(
                    "notes",
                    "Cần cung cấp ít nhất một trong hai: notes hoặc status.");
        }

        String key = normalizeIdempotencyKey(idempotencyKey);
        String fingerprint = fingerprint(sessionId, payload.getStatus(), notes, reason, expectedVersion);

        // Kiểm tra phạm vi trước khi replay để không lộ kết quả của buổi ngoài quyền truy cập.
        Session session = loadSession(sessionId);
        sessionAccessPolicy.requireUpdateScope(session);

        // Idempotency phải chạy trước khi so version: lần gửi lặp mang version cũ đã bị tăng.
        if (key != null) {
            SessionNotesUpdateResponse replayed = replayIfPresent(key, fingerprint);
            if (replayed != null) {
                return replayed;
            }
        }

        requireVersion(session, expectedVersion);

        Long actorId = currentActorId();
        LocalDateTime changedAt = LocalDateTime.now();
        String correlationId = CorrelationContext.getOrCreate();

        String beforeState = snapshot(session);

        SessionStatus fromStatus = session.getStatus();
        SessionStatus targetStatus = payload.getStatus();
        boolean transition = resolveTransition(session, fromStatus, targetStatus, reason);

        if (payload.getNotes() != null) {
            // BR-SES-06 — notes là trường vận hành, được lưu cùng thao tác.
            session.setNotes(notes);
        }
        session.setUpdatedBy(actorId);
        session.setUpdatedAt(changedAt);

        Session saved;
        try {
            saved = sessionRepository.saveAndFlush(session);
        } catch (OptimisticLockingFailureException ex) {
            throw new SessionAuditConflictException(
                    "SESSION_VERSION_CONFLICT",
                    "Phiên bản buổi học đã thay đổi, vui lòng tải lại rồi thử lại.");
        }

        LocalDateTime effectiveChangedAt = saved.getUpdatedAt() != null ? saved.getUpdatedAt() : changedAt;

        Long historyId = null;
        if (transition) {
            SessionStatusHistory history = historyRepository.saveAndFlush(SessionStatusHistory.builder()
                    .sessionId(saved.getId())
                    .fromStatus(fromStatus)
                    .toStatus(targetStatus)
                    .reason(reason)
                    .changedBy(actorId)
                    .changedAt(effectiveChangedAt)
                    .correlationId(correlationId)
                    .idempotencyKey(key)
                    .build());
            historyId = history.getId();
        }

        auditLogRepository.saveAndFlush(SessionAuditLog.builder()
                .actorId(actorId)
                .action(transition ? SessionAuditAction.SESSION_STATUS_CHANGE : SessionAuditAction.SESSION_NOTES_UPDATE)
                .entityType(ENTITY_TYPE_SESSION)
                .entityId(saved.getId())
                .beforeState(beforeState)
                .afterState(snapshot(saved))
                .reason(reason)
                .correlationId(correlationId)
                .idempotencyKey(key)
                .createdAt(effectiveChangedAt)
                .build());

        SessionNotesUpdateResponse response = SessionNotesUpdateResponse.builder()
                .sessionId(saved.getId())
                .status(saved.getStatus())
                .notes(saved.getNotes())
                .version(saved.getVersion())
                .updatedBy(saved.getUpdatedBy())
                .updatedAt(effectiveChangedAt)
                .historyId(historyId)
                .correlationId(correlationId)
                .idempotentReplay(Boolean.FALSE)
                .build();

        if (key != null) {
            storeIdempotentResult(key, saved.getId(), fingerprint, response, effectiveChangedAt);
        }

        log.info("session.notes.updated sessionId={} action={} actor={} correlationId={}",
                saved.getId(),
                transition ? SessionAuditAction.SESSION_STATUS_CHANGE : SessionAuditAction.SESSION_NOTES_UPDATE,
                actorId,
                correlationId);

        return response;
    }

    // ------------------------------------------------------------------- read

    @Override
    @Transactional(readOnly = true)
    public List<SessionStatusHistoryResponse> getHistory(Long sessionId) {
        Session session = loadSession(sessionId);
        // Trainer được phân công / Class Admin; tài khoản khác (vd. Trainee) → 403 FORBIDDEN.
        sessionAccessPolicy.requireReadScope(session);
        return mapper.toHistoryResponses(historyRepository
                .findBySessionIdOrderByChangedAtAscIdAsc(session.getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> searchAuditLogs(AuditLogQuery query) {
        AuditLogQuery filter = query != null ? query : new AuditLogQuery();
        Pageable pageable = PageRequest.of(
                Math.max(filter.getPage() != null ? filter.getPage() : 0, 0),
                clampSize(filter.getSize()),
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));
        return auditLogRepository.findAll(toSpecification(filter), pageable)
                .map(mapper::toAuditLogResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public String exportAuditLogsCsv(AuditLogQuery query) {
        AuditLogQuery filter = query != null ? query : new AuditLogQuery();
        List<SessionAuditLog> rows = auditLogRepository.findAll(
                toSpecification(filter),
                Sort.by(Sort.Direction.ASC, "createdAt").and(Sort.by(Sort.Direction.ASC, "id")));

        StringBuilder csv = new StringBuilder();
        csv.append("id,createdAt,correlationId,action,entityType,entityId,actorId,reason,beforeState,afterState\n");
        int exported = 0;
        for (SessionAuditLog row : rows) {
            if (exported++ >= MAX_EXPORT_ROWS) {
                log.warn("Audit log export truncated at {} rows — hãy thu hẹp điều kiện lọc.", MAX_EXPORT_ROWS);
                break;
            }
            csv.append(csvCell(row.getId()))
                    .append(',').append(csvCell(row.getCreatedAt()))
                    .append(',').append(csvCell(row.getCorrelationId()))
                    .append(',').append(csvCell(row.getAction()))
                    .append(',').append(csvCell(row.getEntityType()))
                    .append(',').append(csvCell(row.getEntityId()))
                    .append(',').append(csvCell(row.getActorId()))
                    .append(',').append(csvCell(row.getReason()))
                    .append(',').append(csvCell(row.getBeforeState()))
                    .append(',').append(csvCell(row.getAfterState()))
                    .append('\n');
        }
        return csv.toString();
    }

    // ---------------------------------------------------------------- helpers

    private Session loadSession(Long sessionId) {
        return sessionRepository.findByIdAndIsActiveTrue(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
    }

    /**
     * AC T2-01 & T2-02 — chỉ SCHEDULED → COMPLETED | CANCELLED mới sinh dòng history.
     *
     * @return {@code true} nếu thực sự có chuyển trạng thái
     */
    private boolean resolveTransition(Session session,
                                      SessionStatus fromStatus,
                                      SessionStatus targetStatus,
                                      String reason) {
        if (targetStatus == null || targetStatus == fromStatus) {
            if (targetStatus != null && targetStatus != SessionStatus.SCHEDULED) {
                throw new SessionAuditConflictException(
                        "SESSION_INVALID_TRANSITION",
                        "Buổi học đã ở trạng thái " + fromStatus + ", không thể chuyển sang "
                                + targetStatus + " lần nữa.");
            }
            return false;
        }
        if (fromStatus != SessionStatus.SCHEDULED) {
            throw new SessionAuditConflictException(
                    "SESSION_INVALID_TRANSITION",
                    "Chỉ có thể cập nhật buổi học ở trạng thái SCHEDULED. Trạng thái hiện tại: "
                            + fromStatus + ".");
        }
        if (targetStatus == SessionStatus.CANCELLED) {
            sessionAccessPolicy.requireCancelScope();
            requireActiveCalendarVersion(session);
            session.setCancelReason(requireCancelReason(reason));
        } else if (targetStatus == SessionStatus.COMPLETED) {
            requireActiveCalendarVersion(session);
            requireStartTimeReached(session);
        } else {
            throw SessionAuditValidationException.of(
                    "status",
                    "Chỉ cho phép COMPLETED hoặc CANCELLED. Giá trị nhận được: " + targetStatus + ".");
        }
        session.setStatus(targetStatus);
        return true;
    }

    private void requireVersion(Session session, Long expectedVersion) {
        if (expectedVersion != null && !expectedVersion.equals(session.getVersion())) {
            throw new SessionAuditConflictException(
                    "SESSION_VERSION_CONFLICT",
                    "Phiên bản buổi học đã thay đổi, vui lòng tải lại (currentVersion="
                            + session.getVersion() + ").");
        }
    }

    private void requireActiveCalendarVersion(Session session) {
        CalendarVersion version = session.getCalendarVersion();
        if (version == null
                || version.getStatus() != CalendarVersionStatus.ACTIVE
                || !Boolean.TRUE.equals(version.getIsActive())) {
            throw new SessionAuditConflictException(
                    "CALENDAR_VERSION_NOT_ACTIVE",
                    "Chỉ cập nhật buổi học khi Calendar Version đang ACTIVE.");
        }
    }

    private void requireStartTimeReached(Session session) {
        if (session.getStartTime() == null || session.getStartTime().isAfter(LocalDateTime.now())) {
            throw new SessionAuditConflictException(
                    "SESSION_INVALID_TRANSITION",
                    "Chỉ có thể hoàn thành buổi học khi đã tới giờ bắt đầu (startTime <= now).");
        }
    }

    /**
     * Chặn client tự set thông tin audit (server-set — T2 mục 1, bảng validation mục 8).
     */
    private void rejectClientSuppliedAuditFields(UpdateSessionNotesRequest payload) {
        Map<String, Object> supplied = payload.getClientSuppliedAuditFields();
        if (supplied == null || supplied.isEmpty()) {
            return;
        }
        Map<String, List<String>> fieldErrors = new LinkedHashMap<>();
        for (String field : supplied.keySet()) {
            fieldErrors.put(field, List.of("Trường '" + field + "' do hệ thống tự ghi, client không được gửi."));
        }
        throw new SessionAuditValidationException(
                "VALIDATION_FAILED", fieldErrors, "Validation failed");
    }

    private String normalizeNotes(String rawNotes) {
        if (rawNotes == null) {
            return null;
        }
        String notes = rawNotes.trim();
        if (notes.length() > MAX_NOTES_LENGTH) {
            throw SessionAuditValidationException.of(
                    "notes",
                    "Ghi chú không được vượt quá " + MAX_NOTES_LENGTH + " ký tự.");
        }
        return notes.isEmpty() ? null : notes;
    }

    private String normalizeReason(String rawReason) {
        if (rawReason == null) {
            return null;
        }
        String reason = rawReason.trim();
        if (reason.length() > MAX_REASON_LENGTH) {
            throw SessionAuditValidationException.of(
                    "reason",
                    "Lý do không được vượt quá " + MAX_REASON_LENGTH + " ký tự.");
        }
        return reason.isEmpty() ? null : reason;
    }

    private String requireCancelReason(String reason) {
        if (reason == null) {
            throw SessionAuditValidationException.of(
                    "reason",
                    "Lý do hủy là bắt buộc khi hủy buổi học (BR-SES-03).");
        }
        return reason;
    }

    private String normalizeIdempotencyKey(String rawKey) {
        if (rawKey == null || rawKey.isBlank()) {
            return null;
        }
        String key = rawKey.trim();
        if (key.length() > MAX_IDEMPOTENCY_KEY_LENGTH) {
            throw SessionAuditValidationException.of(
                    "Idempotency-Key",
                    "Idempotency-Key không được vượt quá " + MAX_IDEMPOTENCY_KEY_LENGTH + " ký tự.");
        }
        return key;
    }

    private Long currentActorId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof UserPrincipal principal) {
            return principal.getUser().getId();
        }
        throw new AccessDeniedException("Không xác định được người thực hiện thao tác.");
    }

    private String snapshot(Session session) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("sessionId", session.getId());
        state.put("status", session.getStatus() != null ? session.getStatus().name() : null);
        state.put("notes", session.getNotes());
        state.put("cancelReason", session.getCancelReason());
        state.put("version", session.getVersion());
        try {
            return objectMapper.writeValueAsString(state);
        } catch (Exception ex) {
            log.warn("Cannot serialize audit snapshot for sessionId={}: {}", session.getId(), ex.getMessage());
            return null;
        }
    }

    private String fingerprint(Long sessionId,
                               SessionStatus status,
                               String notes,
                               String reason,
                               Long expectedVersion) {
        String raw = String.join("|",
                String.valueOf(sessionId),
                status != null ? status.name() : "",
                notes != null ? notes : "",
                reason != null ? reason : "",
                expectedVersion != null ? String.valueOf(expectedVersion) : "");
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }

    private SessionNotesUpdateResponse replayIfPresent(String key, String fingerprint) {
        return idempotencyRepository.findByIdempotencyKey(key)
                .map(record -> {
                    if (!record.getRequestFingerprint().equals(fingerprint)) {
                        throw new SessionAuditConflictException(
                                "IDEMPOTENCY_KEY_REUSED",
                                "Idempotency-Key đã được dùng cho một payload khác.");
                    }
                    SessionNotesUpdateResponse replayed = readStoredResponse(record);
                    replayed.setIdempotentReplay(Boolean.TRUE);
                    log.info("session.notes.idempotent_replay key={} sessionId={}", key, record.getSessionId());
                    return replayed;
                })
                .orElse(null);
    }

    private SessionNotesUpdateResponse readStoredResponse(SessionAuditIdempotencyRecord record) {
        try {
            SessionNotesUpdateResponse stored = objectMapper.readValue(
                    record.getResponsePayload(),
                    new TypeReference<SessionNotesUpdateResponse>() {
                    });
            return stored != null ? stored : SessionNotesUpdateResponse.builder()
                    .sessionId(record.getSessionId())
                    .correlationId(CorrelationContext.getOrCreate())
                    .build();
        } catch (Exception ex) {
            log.warn("Cannot deserialize stored idempotent response key={}: {}", record.getIdempotencyKey(), ex.getMessage());
            return SessionNotesUpdateResponse.builder()
                    .sessionId(record.getSessionId())
                    .correlationId(CorrelationContext.getOrCreate())
                    .build();
        }
    }

    private void storeIdempotentResult(String key,
                                       Long sessionId,
                                       String fingerprint,
                                       SessionNotesUpdateResponse response,
                                       LocalDateTime createdAt) {
        try {
            idempotencyRepository.saveAndFlush(SessionAuditIdempotencyRecord.builder()
                    .idempotencyKey(key)
                    .sessionId(sessionId)
                    .requestFingerprint(fingerprint)
                    .responsePayload(objectMapper.writeValueAsString(response))
                    .createdAt(createdAt)
                    .build());
        } catch (Exception ex) {
            // Lần gửi song song cùng key: lần đầu đã thắng, lần này bị từ chối để tránh ghi trùng.
            log.warn("Cannot persist idempotency record key={}: {}", key, ex.getMessage());
            throw new SessionAuditConflictException(
                    "IDEMPOTENCY_KEY_REUSED",
                    "Idempotency-Key đang được xử lý bởi một request khác, vui lòng tải lại kết quả.");
        }
    }

    private int clampSize(Integer size) {
        if (size == null || size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }

    private Specification<SessionAuditLog> toSpecification(AuditLogQuery filter) {
        return (root, cq, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (filter.getEntityType() != null && !filter.getEntityType().isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("entityType")),
                        filter.getEntityType().trim().toUpperCase()));
            }
            if (filter.getEntityId() != null) {
                predicates.add(cb.equal(root.get("entityId"), filter.getEntityId()));
            }
            if (filter.getActorId() != null) {
                predicates.add(cb.equal(root.get("actorId"), filter.getActorId()));
            }
            if (filter.getAction() != null) {
                predicates.add(cb.equal(root.get("action"), filter.getAction()));
            }
            if (filter.getCorrelationId() != null && !filter.getCorrelationId().isBlank()) {
                predicates.add(cb.equal(root.get("correlationId"), filter.getCorrelationId().trim()));
            }
            if (filter.getFrom() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), filter.getFrom()));
            }
            if (filter.getTo() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), filter.getTo()));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private String csvCell(Object value) {
        if (value == null) {
            return "";
        }
        String text = value instanceof Enum<?> enumValue ? enumValue.name() : String.valueOf(value);
        boolean needsQuoting = text.indexOf(',') >= 0 || text.indexOf('"') >= 0
                || text.indexOf('\n') >= 0 || text.indexOf('\r') >= 0;
        String escaped = text.replace("\"", "\"\"");
        return needsQuoting ? '"' + escaped + '"' : escaped;
    }
}
