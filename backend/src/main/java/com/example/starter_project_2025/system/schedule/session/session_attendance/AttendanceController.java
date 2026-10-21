package com.example.starter_project_2025.system.schedule.session.session_attendance;

import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceHistoryResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceDemoSeedResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.AttendanceSheetResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.BulkAttendanceRequest;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.BulkAttendanceResponse;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.CreateAttendanceRequest;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.UpdateAttendanceRequest;
import com.example.starter_project_2025.system.schedule.session.session_attendance.exception.AttendanceValidationException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

/**
 * T1 / US-DEV6-01 — Session attendance API (SCR-53).
 *
 * <pre>
 * POST   /api/v1/attendance-records                          record one student
 * PATCH  /api/v1/attendance-records/{id}                     partial update (status, note)
 * PUT    /api/v1/attendance-records/{id}                     full update (status required)
 * POST   /api/v1/sessions/{sessionId}/attendance:bulk        upsert the whole sheet
 * POST   /api/v1/sessions/{sessionId}/attendance:demo-seed   generate demo attendance
 * GET    /api/v1/sessions/{sessionId}/attendance             sheet of a session
 * GET    /api/v1/attendance-records/{id}                     one record
 * GET    /api/v1/attendance-records/{id}/history             append-only history
 * </pre>
 *
 * <p>Every write accepts {@code Idempotency-Key} and {@code X-Correlation-Id}; updates use
 * {@code If-Match} (ETag = version) for optimistic locking (NFR-DATA).</p>
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Session Attendance (T1)",
        description = "Record and update attendance per session — assigned trainer / Class Admin")
public class AttendanceController {

    AttendanceService attendanceService;

    // ================================================================== write

    @PostMapping("/attendance-records")
    @PreAuthorize("hasAuthority('ATTENDANCE_CREATE')")
    @Operation(
            summary = "Record attendance for one student",
            description = """
                    Creates the record for the (sessionId, studentId) pair. The server sets
                    recordedBy/At, classId, calendarVersionId and attendanceDate, and writes
                    history + audit + outbox rows.
                    - 201: created (with ETag = version)
                    - 422 VALIDATION_FAILED: missing/invalid sessionId or studentId, status outside
                      the enum, note > 500 characters, or client-supplied system fields
                    - 404 SESSION_NOT_FOUND / STUDENT_NOT_FOUND
                    - 409 SESSION_CANCELLED / CALENDAR_VERSION_NOT_ACTIVE / CLASS_NOT_ONGOING /
                      ATTENDANCE_LOCKED / ATTENDANCE_DUPLICATE / IDEMPOTENCY_KEY_REUSED
                    - 422 SESSION_DATE_IN_FUTURE / STUDENT_NOT_IN_CLASS / STUDENT_NOT_ACTIVE
                    - 503 CONTRACT_UNAVAILABLE (strict mode)
                    - 401/403: unauthenticated / outside the assigned scope
                    """)
    public ResponseEntity<AttendanceResponse> create(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody(required = false) CreateAttendanceRequest body) {

        AttendanceResponse response = attendanceService.create(body, idempotencyKey);
        return ResponseEntity.created(URI.create("/api/v1/attendance-records/" + response.getId()))
                .eTag(String.valueOf(response.getVersion()))
                .body(response);
    }

    @PatchMapping("/attendance-records/{id}")
    @PreAuthorize("hasAuthority('ATTENDANCE_UPDATE')")
    @Operation(
            summary = "Partially update an attendance record (status, note)",
            description = """
                    Requires If-Match (or the version field) to match the current record.
                    - 200: updated (version + 1) or unchanged payload
                    - 422 VALIDATION_FAILED: status outside the enum, note > 500 characters,
                      or client-supplied system fields
                    - 404 ATTENDANCE_NOT_FOUND / SESSION_NOT_FOUND
                    - 409 ATTENDANCE_VERSION_CONFLICT (with currentVersion) / ATTENDANCE_LOCKED /
                      SESSION_CANCELLED / CALENDAR_VERSION_NOT_ACTIVE / CLASS_NOT_ONGOING
                    """)
    public ResponseEntity<AttendanceResponse> patch(
            @PathVariable Long id,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody(required = false) UpdateAttendanceRequest body) {

        UpdateAttendanceRequest payload = body != null ? body : new UpdateAttendanceRequest();
        Long expectedVersion = resolveExpectedVersion(ifMatch, payload.getVersion());
        AttendanceResponse response =
                attendanceService.update(id, payload, expectedVersion, idempotencyKey, false);
        return respond(response);
    }

    @PutMapping("/attendance-records/{id}")
    @PreAuthorize("hasAuthority('ATTENDANCE_UPDATE')")
    @Operation(
            summary = "Fully update an attendance record (status required)",
            description = """
                    Same as PATCH but status is mandatory (replace semantics: an omitted note
                    clears the stored note). `reason` is required when the record is LOCKED
                    (class COMPLETED).
                    """)
    public ResponseEntity<AttendanceResponse> replace(
            @PathVariable Long id,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody(required = false) UpdateAttendanceRequest body) {

        UpdateAttendanceRequest payload = body != null ? body : new UpdateAttendanceRequest();
        Long expectedVersion = resolveExpectedVersion(ifMatch, payload.getVersion());
        AttendanceResponse response =
                attendanceService.update(id, payload, expectedVersion, idempotencyKey, true);
        return respond(response);
    }

    @PostMapping("/sessions/{sessionId}/attendance:bulk")
    @PreAuthorize("hasAnyAuthority('ATTENDANCE_UPDATE','ATTENDANCE_CREATE')")
    @Operation(
            summary = "Upsert the whole attendance sheet of a session (SCR-53)",
            description = """
                    mode = UPSERT (default) | CREATE_ONLY.
                    Returns 200 with a results[] entry per row; business failures (student not in
                    class, not ACTIVE, version mismatch, already existing in CREATE_ONLY) come back
                    as REJECTED with code/message/currentVersion while valid rows are still written.
                    - 422 VALIDATION_FAILED: empty items, > 200 rows, duplicated studentId,
                      invalid status, note > 500 characters
                    - 404 SESSION_NOT_FOUND
                    - 409 SESSION_CANCELLED / CALENDAR_VERSION_NOT_ACTIVE / CLASS_NOT_ONGOING /
                      ATTENDANCE_LOCKED / IDEMPOTENCY_KEY_REUSED
                    """)
    public ResponseEntity<BulkAttendanceResponse> bulk(
            @PathVariable Long sessionId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody(required = false) BulkAttendanceRequest body) {

        BulkAttendanceResponse response = attendanceService.bulk(sessionId, body, idempotencyKey);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/sessions/{sessionId}/attendance:demo-seed")
    @PreAuthorize("hasAnyAuthority('ATTENDANCE_UPDATE','ATTENDANCE_CREATE')")
    @Operation(
            summary = "Generate sample attendance for a session (demo)",
            description = """
                    Creates attendance for the fixed demo cohort (students 2001…2008) that has no
                    record yet. Records go through the normal write path, so history/audit/outbox
                    rows are produced like a real request. Idempotent per student.
                    Disable with attendance.demo.enabled=false.
                    - 200: created/skipped counters + records
                    - 409 SESSION_CANCELLED / CALENDAR_VERSION_NOT_ACTIVE / CLASS_NOT_ONGOING /
                      ATTENDANCE_LOCKED / DEMO_SEED_DISABLED
                    - 422 SESSION_DATE_IN_FUTURE (a session that has not happened yet)
                    - 404 SESSION_NOT_FOUND, 401/403 for authentication/scope
                    """)
    public ResponseEntity<AttendanceDemoSeedResponse> seedDemoAttendance(
            @PathVariable Long sessionId) {
        return ResponseEntity.ok(attendanceService.seedDemoAttendance(sessionId));
    }

    // =================================================================== read

    @GetMapping("/sessions/{sessionId}/attendance")
    @PreAuthorize("hasAuthority('ATTENDANCE_READ')")
    @Operation(
            summary = "Attendance sheet of a session (SCR-53)",
            description = """
                    Returns the records plus PRESENT/ABSENT/LATE/EXCUSED counters and the locked
                    flag.
                    - 200: also when there is no record yet (empty state)
                    - 404 SESSION_NOT_FOUND
                    - 403: outside the assigned scope
                    """)
    public ResponseEntity<AttendanceSheetResponse> getSessionSheet(@PathVariable Long sessionId) {
        return ResponseEntity.ok(attendanceService.getSessionSheet(sessionId));
    }

    @GetMapping("/attendance-records/{id}")
    @PreAuthorize("hasAnyAuthority('ATTENDANCE_READ','ATTENDANCE_READ_SELF')")
    @Operation(
            summary = "Read one attendance record",
            description = """
                    The assigned trainer / Class Admin can read any record of their session;
                    a trainee with ATTENDANCE_READ_SELF can only read their own record (SCR-70).
                    """)
    public ResponseEntity<AttendanceResponse> get(@PathVariable Long id) {
        return respond(attendanceService.get(id));
    }

    @GetMapping("/attendance-records/{id}/history")
    @PreAuthorize("hasAuthority('ATTENDANCE_READ')")
    @Operation(
            summary = "Append-only history of an attendance record",
            description = "Every create/update/correction adds one immutable row (BR-ATT-04).")
    public ResponseEntity<List<AttendanceHistoryResponse>> getHistory(@PathVariable Long id) {
        return ResponseEntity.ok(attendanceService.getHistory(id));
    }

    // ================================================================ internal

    private ResponseEntity<AttendanceResponse> respond(AttendanceResponse response) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
        if (response.getVersion() != null) {
            builder = builder.eTag(String.valueOf(response.getVersion()));
        }
        return builder.body(response);
    }

    /**
     * Accepts {@code If-Match: 3}, {@code "3"}, {@code W/"3"} and falls back to the {@code version}
     * field in the body. A non-numeric value ⇒ 422.
     */
    private Long resolveExpectedVersion(String ifMatch, Long bodyVersion) {
        if (ifMatch == null || ifMatch.isBlank()) {
            return bodyVersion;
        }
        String normalized = ifMatch.trim();
        if (normalized.startsWith("W/")) {
            normalized = normalized.substring(2);
        }
        normalized = normalized.replace("\"", "").trim();
        if (normalized.isEmpty() || "*".equals(normalized)) {
            return bodyVersion;
        }
        try {
            return Long.parseLong(normalized);
        } catch (NumberFormatException ex) {
            throw AttendanceValidationException.of("If-Match",
                    "Invalid If-Match header (ETag/version): " + ifMatch);
        }
    }
}
