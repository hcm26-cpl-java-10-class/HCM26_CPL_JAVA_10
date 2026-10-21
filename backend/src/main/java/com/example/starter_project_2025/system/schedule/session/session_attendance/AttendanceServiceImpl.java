package com.example.starter_project_2025.system.schedule.session.session_attendance;

import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceHistoryResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceDemoSeedResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceSheetResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.BulkAttendanceItem;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.BulkAttendanceItemResult;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.BulkAttendanceRequest;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.BulkAttendanceResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.CreateAttendanceRequest;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.UpdateAttendanceRequest;
import com.example.starter_project_2025.system.schedule.session.session_attendance.exception.AttendanceConflictException;
import com.example.starter_project_2025.system.schedule.session.session_attendance.exception.AttendanceContractUnavailableException;
import com.example.starter_project_2025.system.schedule.session.session_attendance.exception.AttendanceNotFoundException;
import com.example.starter_project_2025.system.schedule.session.session_attendance.exception.AttendanceValidationException;
import com.example.starter_project_2025.system.schedule.session_audit.CorrelationContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import static com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceCodes.ATTENDANCE_DUPLICATE;
import static com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceCodes.ATTENDANCE_LOCKED;
import static com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceCodes.ATTENDANCE_VERSION_CONFLICT;
import static com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceCodes.CALENDAR_VERSION_NOT_ACTIVE;
import static com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceCodes.CLASS_NOT_ONGOING;
import static com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceCodes.IDEMPOTENCY_KEY_REUSED;
import static com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceCodes.SESSION_CANCELLED;
import static com.example.starter_project_2025.system.schedule.session.session_attendance.AttendanceCodes.SESSION_DATE_IN_FUTURE;

/**
 * T1 — Hiện thực luồng ghi/cập nhật điểm danh theo Session.
 *
 * <p>Mỗi thao tác ghi chạy trong <b>một transaction</b> và luôn tạo:</p>
 * <ol>
 *     <li>1 dòng {@link Attendance} (upsert theo cặp sessionId + studentId),</li>
 *     <li>1 dòng {@link AttendanceHistory} (append-only, before/after),</li>
 *     <li>1 dòng {@link AttendanceAuditLog} (actor, thời gian, correlation ID, lý do),</li>
 *     <li>1 {@link AttendanceOutboxEvent} với {@code dedupKey} duy nhất (phát đúng một lần).</li>
 * </ol>
 *
 * <p>Idempotency-Key được kiểm <b>trước</b> khi so version để lần gửi lặp (mang version cũ)
 * vẫn trả đúng kết quả đầu tiên (AC T1-06).</p>
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AttendanceServiceImpl implements AttendanceService {

    /** Note tối đa 500 ký tự (T1 mục 1). */
    static final int MAX_NOTE_LENGTH = 500;
    static final int MAX_REASON_LENGTH = 500;
    static final int MAX_IDEMPOTENCY_KEY_LENGTH = 120;
    static final int MAX_BULK_ITEMS = 200;

    static final String ENTITY_TYPE = "ATTENDANCE";
    static final String CLASS_STATUS_ONGOING = "ONGOING";
    static final String CLASS_STATUS_ACTIVE = "ACTIVE";
    static final String CLASS_STATUS_COMPLETED = "COMPLETED";

    AttendanceRepository attendanceRepository;
    AttendanceHistoryRepository historyRepository;
    AttendanceAuditLogRepository auditLogRepository;
    AttendanceOutboxEventRepository outboxRepository;
    AttendanceIdempotencyRepository idempotencyRepository;
    SessionRepository sessionRepository;
    AttendanceAccessPolicy accessPolicy;
    AttendanceContractGateway contractGateway;
    AttendanceMapper mapper;
    ObjectMapper objectMapper;
    Clock clock;

    /**
     * OD-ATT-07 — khi hệ thống nguồn không trả lời: mặc định fail-open (chỉ cảnh báo) để
     * không chặn nghiệp vụ; bật strict để trả 503 {@code CONTRACT_UNAVAILABLE}.
     */
    @NonFinal
    @Value("${attendance.contract.strict:false}")
    boolean strictContract;

    /** OD-ATT-09 — bắt buộc note khi ABSENT/EXCUSED (mặc định tắt). */
    @NonFinal
    @Value("${attendance.note-required-for-absence:false}")
    boolean noteRequiredForAbsence;

    /** Demo seeding on demand — turn off in production ({@code attendance.demo.enabled=false}). */
    @NonFinal
    @Value("${attendance.demo.enabled:true}")
    boolean demoEnabled;

    // =================================================================== create

    @Override
    public AttendanceResponse create(CreateAttendanceRequest request, String idempotencyKey) {
        CreateAttendanceRequest payload = request != null ? request : new CreateAttendanceRequest();
        rejectSystemFields(payload.getClientSuppliedSystemFields());

        // Collect every field error in one response (AC T1-03) so the UI can show them all.
        Map<String, List<String>> fieldErrors = new LinkedHashMap<>();
        if (payload.getSessionId() == null || payload.getSessionId() <= 0) {
            fieldErrors.put("sessionId", List.of("Session ID is required and must be a positive number."));
        }
        if (payload.getStudentId() == null || payload.getStudentId() <= 0) {
            fieldErrors.put("studentId", List.of("Student ID is required and must be a positive number."));
        }

        AttendanceStatus status = null;
        if (payload.getStatus() == null || payload.getStatus().isBlank()) {
            fieldErrors.put("status", List.of("Attendance status is required."));
        } else {
            status = AttendanceStatus.parse(payload.getStatus());
            if (status == null) {
                fieldErrors.put("status", List.of(
                        "Invalid status. Allowed values: " + AttendanceStatus.allowedValues() + "."));
            }
        }

        String note = null;
        try {
            note = normalizeNote(payload.getNote(), "note");
        } catch (AttendanceValidationException ex) {
            fieldErrors.putAll(ex.getFieldErrors());
        }
        if (status != null) {
            try {
                requireNotePolicy(status, note);
            } catch (AttendanceValidationException ex) {
                fieldErrors.putAll(ex.getFieldErrors());
            }
        }
        if (!fieldErrors.isEmpty()) {
            throw AttendanceValidationException.ofFields(fieldErrors, "Validation failed");
        }

        Long sessionId = payload.getSessionId();
        Long studentId = payload.getStudentId();

        String key = normalizeIdempotencyKey(idempotencyKey);
        String correlationId = CorrelationContext.getOrCreate();
        Long actorId = accessPolicy.currentActorId();
        String fingerprint = fingerprint("CREATE", sessionId, studentId,
                status.name(), note, null, null);

        Session session = loadSession(sessionId);
        accessPolicy.requireWriteScope(session);

        if (key != null) {
            AttendanceResponse replayed = replay(key, "CREATE", fingerprint, AttendanceResponse.class);
            if (replayed != null) {
                return replayed;
            }
        }

        SessionFacts facts = describeForWrite(session);
        requireWritable(facts, false);
        AttendanceMembershipStatus membership = resolveMembership(facts, studentId);
        requireMembership(membership, studentId);

        attendanceRepository.findBySessionIdAndStudentId(sessionId, studentId).ifPresent(existing -> {
            throw new AttendanceConflictException(ATTENDANCE_DUPLICATE,
                    "This student already has an attendance record for this session; use update instead.",
                    existing.versionOrZero());
        });

        Attendance entity = Attendance.builder()
                .sessionId(sessionId)
                .classId(facts.classId())
                .calendarVersionId(facts.calendarVersionId())
                .studentId(studentId)
                .status(status)
                .note(note)
                .attendanceDate(facts.attendanceDate())
                .membershipStatus(membership)
                .isActive(Boolean.TRUE)
                .build();
        entity.setCreatedBy(actorId);
        entity.setUpdatedBy(actorId);

        Attendance saved = persist(entity, true);
        LocalDateTime changedAt = timestampOf(saved);

        writeHistory(saved, AttendanceHistoryAction.CREATE, null, status, null, note,
                null, saved.versionOrZero(), null, actorId, changedAt, correlationId, key);
        writeAudit(AttendanceAuditAction.ATTENDANCE_RECORDED, saved, null, snapshot(saved),
                null, correlationId, key, actorId, changedAt);
        writeOutbox(AttendanceOutboxEventType.ATTENDANCE_RECORDED, saved, correlationId, changedAt);

        AttendanceResponse response = mapper.toResponse(saved, facts.locked());
        response.setCorrelationId(correlationId);
        response.setIdempotentReplay(Boolean.FALSE);
        storeIdempotent(key, "CREATE", fingerprint, response, 201, saved.getId(), sessionId, changedAt);

        log.info("attendance.recorded id={} sessionId={} studentId={} status={} actor={} correlationId={}",
                saved.getId(), sessionId, studentId, status, actorId, correlationId);
        return response;
    }

    // =================================================================== update

    @Override
    public AttendanceResponse update(Long id,
                                     UpdateAttendanceRequest request,
                                     Long expectedVersion,
                                     String idempotencyKey,
                                     boolean fullReplace) {

        Long attendanceId = requirePositive(id, "id", "Attendance ID must be a positive number.");
        UpdateAttendanceRequest payload = request != null ? request : new UpdateAttendanceRequest();
        rejectSystemFields(payload.getClientSuppliedSystemFields());

        AttendanceStatus requestedStatus = payload.getStatus() != null
                ? requireStatus(payload.getStatus(), "status")
                : null;
        if (fullReplace && requestedStatus == null) {
            throw AttendanceValidationException.of("status",
                    "Status is required for a full update (PUT).");
        }
        if (requestedStatus == null && payload.getNote() == null) {
            throw AttendanceValidationException.of("status",
                    "Provide at least one of: status or note.");
        }
        String requestedNote = payload.getNote() != null ? normalizeNote(payload.getNote(), "note") : null;
        String reason = normalizeReason(payload.getReason());

        String key = normalizeIdempotencyKey(idempotencyKey);
        String correlationId = CorrelationContext.getOrCreate();
        Long actorId = accessPolicy.currentActorId();
        Long version = expectedVersion != null ? expectedVersion : payload.getVersion();

        Attendance attendance = loadForUpdate(attendanceId);
        Session session = loadSession(attendance.getSessionId());
        accessPolicy.requireWriteScope(session);

        String fingerprint = fingerprint("UPDATE", attendanceId, attendance.getSessionId(),
                requestedStatus != null ? requestedStatus.name() : "",
                requestedNote, version, reason);

        if (key != null) {
            AttendanceResponse replayed = replay(key, "UPDATE", fingerprint, AttendanceResponse.class);
            if (replayed != null) {
                return replayed;
            }
        }

        SessionFacts facts = describeForWrite(session);
        boolean correction = facts.locked() && accessPolicy.canUnlock();
        requireWritable(facts, correction);
        if (correction) {
            accessPolicy.requireUnlockScope();
            if (reason == null) {
                throw AttendanceValidationException.of("reason",
                        "Reason is required when correcting attendance of a COMPLETED class (BR-ATT-03).");
            }
        }

        AttendanceMembershipStatus membership = resolveMembership(facts, attendance.getStudentId());
        requireMembership(membership, attendance.getStudentId());

        requireVersion(attendance, version);

        AttendanceStatus targetStatus = requestedStatus != null ? requestedStatus : attendance.getStatus();
        // PUT is a full replace: an omitted note clears it. PATCH only changes the fields sent.
        String targetNote = fullReplace
                ? requestedNote
                : (payload.getNote() != null ? requestedNote : attendance.getNote());
        requireNotePolicy(targetStatus, targetNote);

        if (targetStatus == attendance.getStatus() && Objects.equals(targetNote, attendance.getNote())) {
            // Same payload again: no second history/outbox row (BR-UNI-20).
            AttendanceResponse unchanged = mapper.toResponse(attendance, facts.locked());
            unchanged.setCorrelationId(correlationId);
            unchanged.setIdempotentReplay(Boolean.FALSE);
            storeIdempotent(key, "UPDATE", fingerprint, unchanged, 200, attendance.getId(),
                    attendance.getSessionId(), LocalDateTime.now(clock));
            return unchanged;
        }

        AttendanceStatus fromStatus = attendance.getStatus();
        String fromNote = attendance.getNote();
        Long versionBefore = attendance.versionOrZero();
        String beforeState = snapshot(attendance);

        attendance.setStatus(targetStatus);
        attendance.setNote(targetNote);
        attendance.setMembershipStatus(membership);
        attendance.setUpdatedBy(actorId);

        Attendance saved = persist(attendance, false);
        LocalDateTime changedAt = timestampOf(saved);
        AttendanceHistoryAction historyAction = correction
                ? AttendanceHistoryAction.CORRECTION
                : AttendanceHistoryAction.UPDATE;
        AttendanceAuditAction auditAction = correction
                ? AttendanceAuditAction.ATTENDANCE_CORRECTED
                : AttendanceAuditAction.ATTENDANCE_UPDATED;
        AttendanceOutboxEventType eventType = correction
                ? AttendanceOutboxEventType.ATTENDANCE_CORRECTED
                : AttendanceOutboxEventType.ATTENDANCE_UPDATED;

        writeHistory(saved, historyAction, fromStatus, targetStatus, fromNote, targetNote,
                versionBefore, saved.versionOrZero(), correction ? reason : null,
                actorId, changedAt, correlationId, key);
        writeAudit(auditAction, saved, beforeState, snapshot(saved),
                correction ? reason : null, correlationId, key, actorId, changedAt);
        writeOutbox(eventType, saved, correlationId, changedAt);

        AttendanceResponse response = mapper.toResponse(saved, facts.locked());
        response.setCorrelationId(correlationId);
        response.setIdempotentReplay(Boolean.FALSE);
        storeIdempotent(key, "UPDATE", fingerprint, response, 200, saved.getId(),
                saved.getSessionId(), changedAt);

        log.info("attendance.updated id={} sessionId={} studentId={} {} -> {} actor={} correlationId={}",
                saved.getId(), saved.getSessionId(), saved.getStudentId(), fromStatus, targetStatus,
                actorId, correlationId);
        return response;
    }

    // ===================================================================== bulk

    @Override
    public BulkAttendanceResponse bulk(Long sessionId, BulkAttendanceRequest request, String idempotencyKey) {

        Long sid = requirePositive(sessionId, "sessionId",
                "Session ID is required and must be a positive number.");
        BulkAttendanceRequest payload = request != null ? request : new BulkAttendanceRequest();
        rejectSystemFields(payload.getClientSuppliedSystemFields());
        AttendanceBulkMode mode = requireMode(payload.getMode());
        List<BulkAttendanceItem> items = payload.getItems() != null ? payload.getItems() : List.of();

        if (items.isEmpty()) {
            throw AttendanceValidationException.of("items", "Attendance items must not be empty.");
        }
        if (items.size() > MAX_BULK_ITEMS) {
            throw AttendanceValidationException.of("items",
                    "A maximum of " + MAX_BULK_ITEMS + " rows can be written per request.");
        }

        List<ParsedItem> parsed = parseItems(items);
        String reason = normalizeReason(payload.getReason());

        String key = normalizeIdempotencyKey(idempotencyKey);
        String correlationId = CorrelationContext.getOrCreate();
        Long actorId = accessPolicy.currentActorId();
        String fingerprint = fingerprint("BULK", sid, mode.name(), reason, null, null,
                parsed.stream().map(ParsedItem::fingerprint).collect(Collectors.joining(";")));

        Session session = loadSession(sid);
        accessPolicy.requireWriteScope(session);

        if (key != null) {
            BulkAttendanceResponse replayed = replay(key, "BULK", fingerprint, BulkAttendanceResponse.class);
            if (replayed != null) {
                return replayed;
            }
        }

        SessionFacts facts = describeForWrite(session);
        boolean correction = facts.locked() && accessPolicy.canUnlock();
        requireWritable(facts, correction);
        if (correction) {
            accessPolicy.requireUnlockScope();
            if (reason == null) {
                throw AttendanceValidationException.of("reason",
                        "Reason is required when correcting the attendance sheet of a COMPLETED class (BR-ATT-03).");
            }
        }

        Map<Long, Attendance> existingByStudent = attendanceRepository
                .findBySessionIdAndStudentIdIn(sid, parsed.stream().map(ParsedItem::studentId).toList())
                .stream()
                .collect(Collectors.toMap(Attendance::getStudentId, a -> a, (left, right) -> left));

        LocalDateTime now = LocalDateTime.now(clock);
        List<BulkAttendanceItemResult> results = new ArrayList<>(parsed.size());
        int created = 0;
        int updated = 0;
        int unchanged = 0;
        int rejected = 0;

        for (ParsedItem item : parsed) {
            AttendanceMembershipStatus membership = resolveMembership(facts, item.studentId());
            if (!membership.isRecordable()) {
                results.add(rejectedResult(item.studentId(), membership));
                rejected++;
                continue;
            }

            Attendance current = existingByStudent.get(item.studentId());
            if (current == null) {
                Attendance entity = Attendance.builder()
                        .sessionId(sid)
                        .classId(facts.classId())
                        .calendarVersionId(facts.calendarVersionId())
                        .studentId(item.studentId())
                        .status(item.status())
                        .note(item.note())
                        .attendanceDate(facts.attendanceDate())
                        .membershipStatus(membership)
                        .isActive(Boolean.TRUE)
                        .build();
                entity.setCreatedBy(actorId);
                entity.setUpdatedBy(actorId);
                Attendance saved = persist(entity, true);

                writeHistory(saved, AttendanceHistoryAction.CREATE, null, item.status(), null, item.note(),
                        null, saved.versionOrZero(), null, actorId, now, correlationId, key);
                writeAudit(AttendanceAuditAction.ATTENDANCE_RECORDED, saved, null, snapshot(saved),
                        null, correlationId, key, actorId, now);
                writeOutbox(AttendanceOutboxEventType.ATTENDANCE_RECORDED, saved, correlationId, now);

                results.add(BulkAttendanceItemResult.builder()
                        .studentId(item.studentId())
                        .result(AttendanceRecordResult.CREATED)
                        .id(saved.getId())
                        .version(saved.versionOrZero())
                        .build());
                created++;
                continue;
            }

            if (mode == AttendanceBulkMode.CREATE_ONLY) {
                results.add(BulkAttendanceItemResult.builder()
                        .studentId(item.studentId())
                        .result(AttendanceRecordResult.REJECTED)
                        .code(ATTENDANCE_DUPLICATE)
                        .message("This student already has an attendance record for this session (CREATE_ONLY mode).")
                        .id(current.getId())
                        .currentVersion(current.versionOrZero())
                        .build());
                rejected++;
                continue;
            }

            if (item.version() != null && !item.version().equals(current.versionOrZero())) {
                results.add(BulkAttendanceItemResult.builder()
                        .studentId(item.studentId())
                        .result(AttendanceRecordResult.REJECTED)
                        .code(ATTENDANCE_VERSION_CONFLICT)
                        .message("Data has changed, please reload.")
                        .id(current.getId())
                        .currentVersion(current.versionOrZero())
                        .build());
                rejected++;
                continue;
            }

            if (current.getStatus() == item.status() && Objects.equals(current.getNote(), item.note())) {
                results.add(BulkAttendanceItemResult.builder()
                        .studentId(item.studentId())
                        .result(AttendanceRecordResult.UNCHANGED)
                        .id(current.getId())
                        .version(current.versionOrZero())
                        .build());
                unchanged++;
                continue;
            }

            AttendanceStatus fromStatus = current.getStatus();
            String fromNote = current.getNote();
            Long versionBefore = current.versionOrZero();
            String beforeState = snapshot(current);

            current.setStatus(item.status());
            current.setNote(item.note());
            current.setMembershipStatus(membership);
            current.setUpdatedBy(actorId);
            Attendance saved = persist(current, false);

            AttendanceHistoryAction historyAction = correction
                    ? AttendanceHistoryAction.CORRECTION
                    : AttendanceHistoryAction.UPDATE;
            writeHistory(saved, historyAction, fromStatus, item.status(), fromNote, item.note(),
                    versionBefore, saved.versionOrZero(), correction ? reason : null,
                    actorId, now, correlationId, key);
            writeAudit(correction
                            ? AttendanceAuditAction.ATTENDANCE_CORRECTED
                            : AttendanceAuditAction.ATTENDANCE_UPDATED,
                    saved, beforeState, snapshot(saved), correction ? reason : null,
                    correlationId, key, actorId, now);
            writeOutbox(correction
                            ? AttendanceOutboxEventType.ATTENDANCE_CORRECTED
                            : AttendanceOutboxEventType.ATTENDANCE_UPDATED,
                    saved, correlationId, now);

            results.add(BulkAttendanceItemResult.builder()
                    .studentId(item.studentId())
                    .result(AttendanceRecordResult.UPDATED)
                    .id(saved.getId())
                    .version(saved.versionOrZero())
                    .build());
            updated++;
        }

        BulkAttendanceResponse response = BulkAttendanceResponse.builder()
                .sessionId(sid)
                .total(parsed.size())
                .created(created)
                .updated(updated)
                .unchanged(unchanged)
                .rejected(rejected)
                .results(results)
                .correlationId(correlationId)
                .idempotentReplay(Boolean.FALSE)
                .build();
        storeIdempotent(key, "BULK", fingerprint, response, 200, null, sid, now);

        log.info("attendance.bulk sessionId={} total={} created={} updated={} unchanged={} rejected={} actor={} correlationId={}",
                sid, parsed.size(), created, updated, unchanged, rejected, actorId, correlationId);
        return response;
    }

    // =============================================================== demo seeding

    /**
     * Demo helper (US-DEV6-01 demo data): creates attendance for the fixed demo cohort
     * (students 2001…2008) that has no record yet. Records are written through the same
     * helpers as a real request, so history/audit/outbox stay consistent.
     */
    @Override
    public AttendanceDemoSeedResponse seedDemoAttendance(Long sessionId) {
        if (!demoEnabled) {
            throw new AttendanceConflictException(AttendanceCodes.DEMO_SEED_DISABLED,
                    "Demo attendance seeding is disabled (attendance.demo.enabled=false).");
        }

        Long sid = requirePositive(sessionId, "sessionId",
                "Session ID is required and must be positive.");
        Session session = loadSession(sid);
        accessPolicy.requireWriteScope(session);

        SessionFacts facts = describeForWrite(session);
        requireWritable(facts, false);

        Long actorId = accessPolicy.currentActorId();
        String correlationId = CorrelationContext.getOrCreate();
        LocalDateTime now = LocalDateTime.now(clock);
        List<AttendanceResponse> created = new ArrayList<>();
        int skipped = 0;

        for (Long studentId : AttendanceDemoData.studentIds()) {
            if (attendanceRepository.findBySessionIdAndStudentId(sid, studentId).isPresent()) {
                skipped++;
                continue;
            }

            AttendanceStatus status = AttendanceDemoData.statusFor(studentId);
            String note = AttendanceDemoData.noteFor(status);
            AttendanceMembershipStatus membership = resolveMembership(facts, studentId);

            Attendance entity = Attendance.builder()
                    .sessionId(sid)
                    .classId(facts.classId())
                    .calendarVersionId(facts.calendarVersionId())
                    .studentId(studentId)
                    .status(status)
                    .note(note)
                    .attendanceDate(facts.attendanceDate())
                    .membershipStatus(membership)
                    .isActive(Boolean.TRUE)
                    .build();
            entity.setCreatedBy(actorId);
            entity.setUpdatedBy(actorId);

            Attendance saved = persist(entity, true);
            writeHistory(saved, AttendanceHistoryAction.CREATE, null, status, null, note,
                    null, saved.versionOrZero(), null, actorId, now, correlationId, null);
            writeAudit(AttendanceAuditAction.ATTENDANCE_RECORDED, saved, null, snapshot(saved),
                    null, correlationId, null, actorId, now);
            writeOutbox(AttendanceOutboxEventType.ATTENDANCE_RECORDED, saved, correlationId, now);

            AttendanceResponse response = mapper.toResponse(saved, facts.locked());
            response.setCorrelationId(correlationId);
            response.setIdempotentReplay(Boolean.FALSE);
            created.add(response);
        }

        log.info("attendance.demo_seeded sessionId={} created={} skipped={} actor={} correlationId={}",
                sid, created.size(), skipped, actorId, correlationId);

        return AttendanceDemoSeedResponse.builder()
                .sessionId(sid)
                .created(created.size())
                .skipped(skipped)
                .records(created)
                .correlationId(correlationId)
                .build();
    }

    // ===================================================================== read

    @Override
    @Transactional(readOnly = true)
    public AttendanceResponse get(Long id) {
        Attendance attendance = load(id);
        Session session = loadSession(attendance.getSessionId());
        accessPolicy.requireRecordReadScope(session, attendance.getStudentId());

        AttendanceResponse response = mapper.toResponse(attendance, isLocked(session));
        response.setCorrelationId(CorrelationContext.getOrCreate());
        response.setIdempotentReplay(Boolean.FALSE);
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public AttendanceSheetResponse getSessionSheet(Long sessionId) {
        Long sid = requirePositive(sessionId, "sessionId",
                "Session ID is required and must be a positive number.");
        Session session = loadSession(sid);
        accessPolicy.requireReadScope(session);

        boolean locked = isLocked(session);
        List<Attendance> rows = attendanceRepository
                .findBySessionIdAndIsActiveTrueOrderByStudentIdAsc(sid);
        List<AttendanceResponse> records = rows.stream()
                .map(row -> mapper.toResponse(row, locked))
                .toList();

        String correlationId = CorrelationContext.getOrCreate();
        records.forEach(record -> record.setCorrelationId(correlationId));

        return AttendanceSheetResponse.builder()
                .sessionId(sid)
                .classId(classIdOf(session))
                .calendarVersionId(session.getCalendarVersionId())
                .attendanceDate(attendanceDateOf(session))
                .sessionStatus(session.getStatus())
                .locked(locked)
                .total(records.size())
                .present(count(rows, AttendanceStatus.PRESENT))
                .absent(count(rows, AttendanceStatus.ABSENT))
                .late(count(rows, AttendanceStatus.LATE))
                .excused(count(rows, AttendanceStatus.EXCUSED))
                .records(records)
                .correlationId(correlationId)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttendanceHistoryResponse> getHistory(Long id) {
        Attendance attendance = load(id);
        Session session = loadSession(attendance.getSessionId());
        accessPolicy.requireRecordReadScope(session, attendance.getStudentId());
        return mapper.toHistoryResponses(
                historyRepository.findByAttendanceIdOrderByChangedAtAscIdAsc(attendance.getId()));
    }

    // ============================================================== session rules

    /**
     * Ảnh chụp các thuộc tính của session dùng cho kiểm tra nghiệp vụ.
     */
    private record SessionFacts(Long sessionId,
                                Long classId,
                                Long calendarVersionId,
                                LocalDate attendanceDate,
                                boolean sessionCancelled,
                                boolean calendarVersionActive,
                                boolean classStatusAvailable,
                                String classStatus,
                                boolean locked) {
    }

    private record ParsedItem(Long studentId, AttendanceStatus status, String note, Long version) {

        String fingerprint() {
            return String.join("|",
                    String.valueOf(studentId),
                    status.name(),
                    note != null ? note : "",
                    version != null ? String.valueOf(version) : "");
        }
    }

    private SessionFacts describeForWrite(Session session) {
        Long classId = classIdOf(session);
        if (classId == null) {
            throw AttendanceValidationException.of("sessionId",
                    "The session is not linked to a class (classId); attendance is unavailable.");
        }
        LocalDate attendanceDate = attendanceDateOf(session);
        if (attendanceDate == null) {
            throw AttendanceValidationException.of("sessionId",
                    "The session has no start time; the attendance date cannot be determined.");
        }

        CalendarVersion version = session.getCalendarVersion();
        boolean calendarVersionActive = version != null
                && version.getStatus() == CalendarVersionStatus.ACTIVE
                && Boolean.TRUE.equals(version.getIsActive());

        AttendanceContractGateway.ClassSnapshot classSnapshot = contractGateway.loadClass(classId);
        if (!classSnapshot.available() && strictContract) {
            throw new AttendanceContractUnavailableException(
                    "Cannot verify class " + classId + " status from the contract; please try again later.");
        }
        boolean locked = classSnapshot.available() && isCompletedClass(classSnapshot.status());

        return new SessionFacts(
                session.getId(),
                classId,
                session.getCalendarVersionId(),
                attendanceDate,
                session.getStatus() == SessionStatus.CANCELLED,
                calendarVersionActive,
                classSnapshot.available(),
                classSnapshot.status(),
                locked);
    }

    /**
     * BR-UNI-08/09/11, BR-ATT-01/03 — preconditions for writing attendance.
     *
     * @param correction fix a LOCKED record with {@code ATTENDANCE_UNLOCK} plus a reason
     */
    private void requireWritable(SessionFacts facts, boolean correction) {
        if (facts.sessionCancelled()) {
            throw new AttendanceConflictException(SESSION_CANCELLED,
                    "The session is cancelled; attendance cannot be recorded or updated.");
        }
        if (facts.locked() && !correction) {
            throw new AttendanceConflictException(ATTENDANCE_LOCKED,
                    "Attendance is locked because the class is COMPLETED. ATTENDANCE_UNLOCK permission and a reason are required.");
        }
        if (!facts.calendarVersionActive() && !correction) {
            throw new AttendanceConflictException(CALENDAR_VERSION_NOT_ACTIVE,
                    "Attendance can only be recorded while the Calendar Version is ACTIVE.");
        }
        if (facts.classStatusAvailable() && hasText(facts.classStatus())) {
            String status = facts.classStatus().trim();
            boolean allowed = CLASS_STATUS_ONGOING.equalsIgnoreCase(status)
                    || CLASS_STATUS_ACTIVE.equalsIgnoreCase(status)
                    || CLASS_STATUS_COMPLETED.equalsIgnoreCase(status);
            if (!allowed) {
                throw new AttendanceConflictException(CLASS_NOT_ONGOING,
                        "Attendance can only be recorded while the class is ONGOING. Current status: " + status + ".");
            }
        }
        if (!facts.locked() && facts.attendanceDate().isAfter(LocalDate.now(clock))) {
            throw AttendanceValidationException.ofCode(SESSION_DATE_IN_FUTURE, "sessionId",
                    "Attendance cannot be recorded for a future session ("
                            + facts.attendanceDate() + ").");
        }
    }

    private AttendanceMembershipStatus resolveMembership(SessionFacts facts, Long studentId) {
        AttendanceContractGateway.MembershipSnapshot snapshot =
                contractGateway.loadMembership(facts.classId(), studentId, facts.attendanceDate());
        if (!snapshot.available()) {
            if (strictContract) {
                throw new AttendanceContractUnavailableException(
                        "Cannot verify student " + studentId + " in class " + facts.classId()
                                + " from the contract; please try again later.");
            }
            return AttendanceMembershipStatus.UNKNOWN;
        }
        return snapshot.status() != null ? snapshot.status() : AttendanceMembershipStatus.UNKNOWN;
    }

    private void requireMembership(AttendanceMembershipStatus membership, Long studentId) {
        switch (membership) {
            case NOT_FOUND -> throw new AttendanceNotFoundException(AttendanceCodes.STUDENT_NOT_FOUND,
                    "Student not found: id=" + studentId + ".");
            case NOT_IN_CLASS -> throw AttendanceValidationException.ofCode(
                    AttendanceCodes.STUDENT_NOT_IN_CLASS, "studentId",
                    "Student " + studentId + " does not belong to this session's class.");
            case INACTIVE -> throw AttendanceValidationException.ofCode(
                    AttendanceCodes.STUDENT_NOT_ACTIVE, "studentId",
                    "Student " + studentId + " is not ACTIVE on the attendance date.");
            default -> {
                // ACTIVE/UNKNOWN: recording is allowed.
            }
        }
    }

    private BulkAttendanceItemResult rejectedResult(Long studentId, AttendanceMembershipStatus membership) {
        String code = switch (membership) {
            case NOT_FOUND -> AttendanceCodes.STUDENT_NOT_FOUND;
            case NOT_IN_CLASS -> AttendanceCodes.STUDENT_NOT_IN_CLASS;
            case INACTIVE -> AttendanceCodes.STUDENT_NOT_ACTIVE;
            default -> AttendanceCodes.VALIDATION_FAILED;
        };
        String message = switch (membership) {
            case NOT_FOUND -> "Student not found: id=" + studentId + ".";
            case NOT_IN_CLASS -> "Student " + studentId + " does not belong to this session's class.";
            case INACTIVE -> "Student " + studentId + " is not ACTIVE on the attendance date.";
            default -> "Invalid student data.";
        };
        return BulkAttendanceItemResult.builder()
                .studentId(studentId)
                .result(AttendanceRecordResult.REJECTED)
                .code(code)
                .message(message)
                .build();
    }

    // ============================================================== idempotency

    private <T> T replay(String key, String scope, String fingerprint, Class<T> responseType) {
        return idempotencyRepository.findByIdempotencyKey(key)
                .map(record -> {
                    if (!scope.equals(record.getScope()) || !record.getRequestFingerprint().equals(fingerprint)) {
                        throw new AttendanceConflictException(IDEMPOTENCY_KEY_REUSED,
                                "Idempotency-Key has already been used for a different request.");
                    }
                    T replayed = readStoredResponse(record, responseType);
                    markReplay(replayed);
                    log.info("attendance.idempotent_replay key={} scope={}", key, scope);
                    return replayed;
                })
                .orElse(null);
    }

    private <T> T readStoredResponse(AttendanceIdempotencyRecord record, Class<T> responseType) {
        try {
            T stored = objectMapper.readValue(record.getResponsePayload(), responseType);
            if (stored != null) {
                return stored;
            }
        } catch (Exception ex) {
            log.warn("Cannot deserialize stored idempotent response key={}: {}",
                    record.getIdempotencyKey(), ex.getMessage());
        }
        throw new AttendanceConflictException(IDEMPOTENCY_KEY_REUSED,
                "Cannot read the stored result for this Idempotency-Key; retry with a new key.");
    }

    private void markReplay(Object response) {
        if (response instanceof AttendanceResponse attendanceResponse) {
            attendanceResponse.setIdempotentReplay(Boolean.TRUE);
            attendanceResponse.setCorrelationId(CorrelationContext.getOrCreate());
        } else if (response instanceof BulkAttendanceResponse bulkResponse) {
            bulkResponse.setIdempotentReplay(Boolean.TRUE);
            bulkResponse.setCorrelationId(CorrelationContext.getOrCreate());
        }
    }

    private void storeIdempotent(String key,
                                 String scope,
                                 String fingerprint,
                                 Object response,
                                 int responseStatus,
                                 Long attendanceId,
                                 Long sessionId,
                                 LocalDateTime createdAt) {
        if (key == null) {
            return;
        }
        try {
            idempotencyRepository.saveAndFlush(AttendanceIdempotencyRecord.builder()
                    .idempotencyKey(key)
                    .scope(scope)
                    .attendanceId(attendanceId)
                    .sessionId(sessionId)
                    .requestFingerprint(fingerprint)
                    .responsePayload(objectMapper.writeValueAsString(response))
                    .responseStatus(responseStatus)
                    .createdAt(createdAt)
                    .build());
        } catch (DataIntegrityViolationException | com.fasterxml.jackson.core.JsonProcessingException ex) {
            log.warn("Cannot store idempotency record key={}: {}", key, ex.getMessage());
            throw new AttendanceConflictException(IDEMPOTENCY_KEY_REUSED,
                    "Idempotency-Key is currently being processed by another request; reload the result.");
        }
    }

    // ================================================================= audit trail

    private void writeHistory(Attendance attendance,
                              AttendanceHistoryAction action,
                              AttendanceStatus fromStatus,
                              AttendanceStatus toStatus,
                              String fromNote,
                              String toNote,
                              Long versionBefore,
                              Long versionAfter,
                              String reason,
                              Long actorId,
                              LocalDateTime changedAt,
                              String correlationId,
                              String idempotencyKey) {
        historyRepository.save(AttendanceHistory.builder()
                .attendanceId(attendance.getId())
                .sessionId(attendance.getSessionId())
                .studentId(attendance.getStudentId())
                .action(action)
                .fromStatus(fromStatus)
                .toStatus(toStatus)
                .fromNote(fromNote)
                .toNote(toNote)
                .versionBefore(versionBefore)
                .versionAfter(versionAfter)
                .reason(reason)
                .changedBy(actorId)
                .changedAt(changedAt)
                .correlationId(correlationId)
                .idempotencyKey(idempotencyKey)
                .build());
    }

    private void writeAudit(AttendanceAuditAction action,
                            Attendance attendance,
                            String beforeState,
                            String afterState,
                            String reason,
                            String correlationId,
                            String idempotencyKey,
                            Long actorId,
                            LocalDateTime createdAt) {
        auditLogRepository.save(AttendanceAuditLog.builder()
                .actorId(actorId)
                .action(action)
                .entityType(ENTITY_TYPE)
                .entityId(attendance.getId())
                .beforeState(beforeState)
                .afterState(afterState)
                .reason(reason)
                .correlationId(correlationId)
                .idempotencyKey(idempotencyKey)
                .createdAt(createdAt)
                .build());
    }

    private void writeOutbox(AttendanceOutboxEventType eventType,
                             Attendance attendance,
                             String correlationId,
                             LocalDateTime occurredAt) {
        String dedupKey = eventType.name() + ":" + attendance.getId() + ":" + attendance.versionOrZero();
        if (outboxRepository.existsByDedupKey(dedupKey)) {
            return;
        }
        outboxRepository.save(AttendanceOutboxEvent.builder()
                .eventType(eventType)
                .aggregateType(ENTITY_TYPE)
                .aggregateId(attendance.getId())
                .payload(snapshot(attendance))
                .status(AttendanceOutboxStatus.PENDING)
                .dedupKey(dedupKey)
                .correlationId(correlationId)
                .occurredAt(occurredAt)
                .attempts(0)
                .build());
    }

    private String snapshot(Attendance attendance) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("id", attendance.getId());
        state.put("sessionId", attendance.getSessionId());
        state.put("classId", attendance.getClassId());
        state.put("calendarVersionId", attendance.getCalendarVersionId());
        state.put("studentId", attendance.getStudentId());
        state.put("status", attendance.getStatus() != null ? attendance.getStatus().name() : null);
        state.put("note", attendance.getNote());
        state.put("attendanceDate",
                attendance.getAttendanceDate() != null ? attendance.getAttendanceDate().toString() : null);
        state.put("membershipStatus",
                attendance.getMembershipStatus() != null ? attendance.getMembershipStatus().name() : null);
        state.put("version", attendance.versionOrZero());
        try {
            return objectMapper.writeValueAsString(state);
        } catch (Exception ex) {
            log.warn("Cannot serialize attendance snapshot id={}: {}", attendance.getId(), ex.getMessage());
            return null;
        }
    }

    // ================================================================== helpers

    private Attendance persist(Attendance entity, boolean creating) {
        try {
            return attendanceRepository.saveAndFlush(entity);
        } catch (OptimisticLockingFailureException ex) {
            throw new AttendanceConflictException(ATTENDANCE_VERSION_CONFLICT,
                    "The attendance record has changed; reload and try again.");
        } catch (DataIntegrityViolationException ex) {
            if (creating) {
                throw new AttendanceConflictException(ATTENDANCE_DUPLICATE,
                        "This student already has an attendance record for this session (possibly a concurrent request).",
                        null);
            }
            throw new AttendanceConflictException(ATTENDANCE_VERSION_CONFLICT,
                    "Attendance data has changed; please reload.", null);
        }
    }

    private void requireVersion(Attendance attendance, Long expectedVersion) {
        if (expectedVersion != null && !expectedVersion.equals(attendance.versionOrZero())) {
            throw new AttendanceConflictException(ATTENDANCE_VERSION_CONFLICT,
                    "Data has changed, please reload (currentVersion="
                            + attendance.versionOrZero() + ").",
                    attendance.versionOrZero());
        }
    }

    private Attendance load(Long id) {
        Long attendanceId = requirePositive(id, "id", "Attendance ID must be a positive number.");
        Attendance attendance = attendanceRepository.findByIdAndIsActiveTrue(attendanceId)
                .orElseThrow(() -> AttendanceNotFoundException.attendance(attendanceId));
        return attendance;
    }

    private Attendance loadForUpdate(Long id) {
        Attendance attendance = attendanceRepository.findByIdForUpdate(id)
                .orElseThrow(() -> AttendanceNotFoundException.attendance(id));
        if (!Boolean.TRUE.equals(attendance.getIsActive())) {
            throw AttendanceNotFoundException.attendance(id);
        }
        return attendance;
    }

    private Session loadSession(Long sessionId) {
        return sessionRepository.findByIdAndIsActiveTrue(sessionId)
                .orElseThrow(() -> AttendanceNotFoundException.session(sessionId));
    }

    private boolean isLocked(Session session) {
        Long classId = classIdOf(session);
        if (classId == null) {
            return false;
        }
        AttendanceContractGateway.ClassSnapshot snapshot = contractGateway.loadClass(classId);
        return snapshot.available() && isCompletedClass(snapshot.status());
    }

    private Long classIdOf(Session session) {
        return session != null ? session.getClassId() : null;
    }

    private LocalDate attendanceDateOf(Session session) {
        return session != null && session.getStartTime() != null
                ? session.getStartTime().toLocalDate()
                : null;
    }

    private boolean isCompletedClass(String status) {
        return hasText(status) && CLASS_STATUS_COMPLETED.equalsIgnoreCase(status.trim());
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private Integer count(List<Attendance> rows, AttendanceStatus status) {
        return (int) rows.stream().filter(row -> row.getStatus() == status).count();
    }

    private LocalDateTime timestampOf(Attendance attendance) {
        return attendance.getUpdatedAt() != null ? attendance.getUpdatedAt() : LocalDateTime.now(clock);
    }

    private Long requirePositive(Long value, String field, String message) {
        if (value == null || value <= 0) {
            throw AttendanceValidationException.of(field, message);
        }
        return value;
    }

    private AttendanceStatus requireStatus(String rawStatus, String field) {
        if (rawStatus == null || rawStatus.isBlank()) {
            throw AttendanceValidationException.of(field, "Attendance status is required.");
        }
        AttendanceStatus status = AttendanceStatus.parse(rawStatus);
        if (status == null) {
            throw AttendanceValidationException.of(field,
                    "Invalid status. Allowed values: " + AttendanceStatus.allowedValues() + ".");
        }
        return status;
    }

    private AttendanceBulkMode requireMode(String rawMode) {
        AttendanceBulkMode mode = AttendanceBulkMode.parse(rawMode);
        if (mode == null) {
            throw AttendanceValidationException.of("mode",
                    "Invalid mode. Allowed values: " + AttendanceBulkMode.allowedValues() + ".");
        }
        return mode;
    }

    private List<ParsedItem> parseItems(List<BulkAttendanceItem> items) {
        List<ParsedItem> parsed = new ArrayList<>(items.size());
        Map<String, List<String>> fieldErrors = new LinkedHashMap<>();
        Map<Long, Integer> firstIndexByStudent = new LinkedHashMap<>();

        for (int index = 0; index < items.size(); index++) {
            BulkAttendanceItem item = items.get(index);
            String prefix = "items[" + index + "]";
            if (item == null) {
                fieldErrors.put(prefix, List.of("Attendance row must not be empty."));
                continue;
            }
            rejectSystemFields(item.getClientSuppliedSystemFields(), fieldErrors, prefix);

            Long studentId = item.getStudentId();
            if (studentId == null || studentId <= 0) {
                fieldErrors.put(prefix + ".studentId", List.of("Student ID is required and must be a positive number."));
            } else if (firstIndexByStudent.putIfAbsent(studentId, index) != null) {
                fieldErrors.put(prefix + ".studentId", List.of(
                        "Student " + studentId + " is duplicated in this request (one record per student per session)."));
            }

            AttendanceStatus status;
            try {
                status = requireStatus(item.getStatus(), prefix + ".status");
            } catch (AttendanceValidationException ex) {
                fieldErrors.putAll(ex.getFieldErrors());
                status = null;
            }

            String note = null;
            try {
                note = normalizeNote(item.getNote(), prefix + ".note");
                if (status != null) {
                    requireNotePolicy(status, note);
                }
            } catch (AttendanceValidationException ex) {
                fieldErrors.putAll(ex.getFieldErrors());
            }

            if (studentId != null && studentId > 0 && status != null && !fieldErrors.containsKey(prefix + ".studentId")) {
                parsed.add(new ParsedItem(studentId, status, note, item.getVersion()));
            }
        }

        if (!fieldErrors.isEmpty()) {
            throw AttendanceValidationException.ofFields(fieldErrors, "Validation failed");
        }
        return parsed;
    }

    private String normalizeNote(String rawNote, String field) {
        if (rawNote == null) {
            return null;
        }
        String note = rawNote.trim();
        if (note.length() > MAX_NOTE_LENGTH) {
            throw AttendanceValidationException.of(field,
                    "Note must not exceed " + MAX_NOTE_LENGTH + " characters.");
        }
        return note.isEmpty() ? null : note;
    }

    private String normalizeReason(String rawReason) {
        if (rawReason == null) {
            return null;
        }
        String reason = rawReason.trim();
        if (reason.length() > MAX_REASON_LENGTH) {
            throw AttendanceValidationException.of("reason",
                    "Reason must not exceed " + MAX_REASON_LENGTH + " characters.");
        }
        return reason.isEmpty() ? null : reason;
    }

    private void requireNotePolicy(AttendanceStatus status, String note) {
        if (noteRequiredForAbsence && status.isAbsence() && (note == null || note.isBlank())) {
            throw AttendanceValidationException.of("note",
                    "A note/reason is required when status is ABSENT or EXCUSED.");
        }
    }

    private void rejectSystemFields(Map<String, Object> supplied) {
        rejectSystemFields(supplied, null, null);
    }

    private void rejectSystemFields(Map<String, Object> supplied,
                                    Map<String, List<String>> fieldErrors,
                                    String prefix) {
        if (supplied == null || supplied.isEmpty()) {
            return;
        }
        Map<String, List<String>> sink = fieldErrors != null ? fieldErrors : new LinkedHashMap<>();
        for (String field : supplied.keySet()) {
            String key = prefix != null ? prefix + "." + field : field;
            sink.put(key, List.of("Field '" + field + "' is server-managed and must not be sent by the client."));
        }
        if (fieldErrors == null) {
            throw AttendanceValidationException.ofFields(sink, "Validation failed");
        }
    }

    private String normalizeIdempotencyKey(String rawKey) {
        if (rawKey == null || rawKey.isBlank()) {
            return null;
        }
        String key = rawKey.trim();
        if (key.length() > MAX_IDEMPOTENCY_KEY_LENGTH) {
            throw AttendanceValidationException.of("Idempotency-Key",
                    "Idempotency-Key must not exceed " + MAX_IDEMPOTENCY_KEY_LENGTH + " characters.");
        }
        return key;
    }

    /**
     * SHA-256 fingerprint of every input that affects the result — same key with a different
     * payload ⇒ 409 {@code IDEMPOTENCY_KEY_REUSED}.
     */
    private String fingerprint(String scope, Object... parts) {
        StringBuilder builder = new StringBuilder(scope);
        for (Object part : parts) {
            builder.append('|').append(part == null ? "" : part.toString());
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(builder.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }
}
