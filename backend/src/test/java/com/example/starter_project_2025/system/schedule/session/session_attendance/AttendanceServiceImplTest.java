package com.example.starter_project_2025.system.schedule.session.session_attendance;

import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.BulkAttendanceItem;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.BulkAttendanceRequest;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.CreateAttendanceRequest;
import com.example.starter_project_2025.system.schedule.session.session_attendance.dto.UpdateAttendanceRequest;
import com.example.starter_project_2025.system.schedule.session.session_attendance.exception.AttendanceValidationException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * T1 — Unit test cho các quy tắc validation thuần (không chạm DB).
 *
 * <p>Bổ sung cho integration test: kiểm tra mã lỗi/fieldErrors chính xác trước khi service
 * gọi repository (AC T1-03, BR-UNI-11, BR-UNI-20).</p>
 */
@ExtendWith(MockitoExtension.class)
class AttendanceServiceImplTest {

    @Mock AttendanceRepository attendanceRepository;
    @Mock AttendanceHistoryRepository historyRepository;
    @Mock AttendanceAuditLogRepository auditLogRepository;
    @Mock AttendanceOutboxEventRepository outboxRepository;
    @Mock AttendanceIdempotencyRepository idempotencyRepository;
    @Mock SessionRepository sessionRepository;
    @Mock AttendanceAccessPolicy accessPolicy;
    @Mock AttendanceContractGateway contractGateway;

    AttendanceServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AttendanceServiceImpl(
                attendanceRepository,
                historyRepository,
                auditLogRepository,
                outboxRepository,
                idempotencyRepository,
                sessionRepository,
                accessPolicy,
                contractGateway,
                new AttendanceMapper(),
                new ObjectMapper(),
                Clock.systemDefaultZone());
    }

    @Test
    void createRejectsMissingIdentifiers() {
        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.create(new CreateAttendanceRequest(), null));

        assertEquals("VALIDATION_FAILED", ex.getCode());
        assertTrue(ex.getFieldErrors().containsKey("sessionId"));
    }

    @Test
    void createRejectsStatusOutsideEnum() {
        CreateAttendanceRequest request = CreateAttendanceRequest.builder()
                .sessionId(1L)
                .studentId(2L)
                .status("HALF_DAY")
                .build();

        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.create(request, null));

        assertEquals("VALIDATION_FAILED", ex.getCode());
        assertTrue(ex.getFieldErrors().containsKey("status"));
    }

    @Test
    void createRejectsTooLongNote() {
        CreateAttendanceRequest request = CreateAttendanceRequest.builder()
                .sessionId(1L)
                .studentId(2L)
                .status("PRESENT")
                .note("x".repeat(501))
                .build();

        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.create(request, null));

        assertTrue(ex.getFieldErrors().containsKey("note"));
    }

    @Test
    void createRejectsClientSuppliedSystemFields() {
        CreateAttendanceRequest request = CreateAttendanceRequest.builder()
                .sessionId(1L)
                .studentId(2L)
                .status("PRESENT")
                .build();
        request.captureUnknownField("recordedBy", 99);

        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.create(request, null));

        assertTrue(ex.getFieldErrors().containsKey("recordedBy"));
    }

    @Test
    void updateRequiresAtLeastOneMutableField() {
        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.update(1L, new UpdateAttendanceRequest(), 0L, null, false));

        assertTrue(ex.getFieldErrors().containsKey("status"));
    }

    @Test
    void putRequiresStatus() {
        UpdateAttendanceRequest request = UpdateAttendanceRequest.builder()
                .note("Chỉ đổi ghi chú")
                .build();

        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.update(1L, request, 0L, null, true));

        assertTrue(ex.getFieldErrors().containsKey("status"));
    }

    @Test
    void updateRejectsClientSuppliedImmutableFields() {
        UpdateAttendanceRequest request = UpdateAttendanceRequest.builder()
                .status("PRESENT")
                .build();
        request.captureUnknownField("studentId", 7);

        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.update(1L, request, 0L, null, false));

        assertTrue(ex.getFieldErrors().containsKey("studentId"));
    }

    @Test
    void getRejectsNonPositiveId() {
        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.get(0L));

        assertTrue(ex.getFieldErrors().containsKey("id"));
    }

    @Test
    void bulkRejectsEmptyItems() {
        BulkAttendanceRequest request = BulkAttendanceRequest.builder().build();

        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.bulk(1L, request, null));

        assertTrue(ex.getFieldErrors().containsKey("items"));
    }

    @Test
    void bulkRejectsMoreThanTwoHundredRows() {
        List<BulkAttendanceItem> items = new ArrayList<>();
        for (int i = 1; i <= 201; i++) {
            items.add(BulkAttendanceItem.builder().studentId((long) i).status("PRESENT").build());
        }
        BulkAttendanceRequest request = BulkAttendanceRequest.builder().items(items).build();

        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.bulk(1L, request, null));

        assertTrue(ex.getFieldErrors().containsKey("items"));
    }

    @Test
    void bulkRejectsDuplicateStudentInSameRequest() {
        BulkAttendanceRequest request = BulkAttendanceRequest.builder()
                .items(List.of(
                        BulkAttendanceItem.builder().studentId(2001L).status("PRESENT").build(),
                        BulkAttendanceItem.builder().studentId(2001L).status("ABSENT").build()))
                .build();

        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.bulk(1L, request, null));

        assertTrue(ex.getFieldErrors().containsKey("items[1].studentId"));
    }

    @Test
    void bulkReportsAllInvalidRowsAtOnce() {
        BulkAttendanceRequest request = BulkAttendanceRequest.builder()
                .items(List.of(
                        BulkAttendanceItem.builder().studentId(null).status("PRESENT").build(),
                        BulkAttendanceItem.builder().studentId(2002L).status("NOPE").build()))
                .build();

        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.bulk(1L, request, null));

        assertTrue(ex.getFieldErrors().containsKey("items[0].studentId"));
        assertTrue(ex.getFieldErrors().containsKey("items[1].status"));
    }

    @Test
    void bulkRejectsUnknownMode() {
        BulkAttendanceRequest request = BulkAttendanceRequest.builder()
                .mode("MERGE")
                .items(List.of(BulkAttendanceItem.builder().studentId(2001L).status("PRESENT").build()))
                .build();

        AttendanceValidationException ex = assertThrows(AttendanceValidationException.class,
                () -> service.bulk(1L, request, null));

        assertTrue(ex.getFieldErrors().containsKey("mode"));
    }

    // ------------------------------------------------------------- enum parsing

    @ParameterizedTest
    @ValueSource(strings = {"present", "PRESENT", " Present "})
    void statusParsingIsCaseInsensitive(String raw) {
        assertEquals(AttendanceStatus.PRESENT, AttendanceStatus.parse(raw));
    }

    @Test
    void statusParsingRejectsUnknownValue() {
        assertNull(AttendanceStatus.parse("HALF_DAY"));
        assertNull(AttendanceStatus.parse(""));
        assertNull(AttendanceStatus.parse(null));
    }

    @Test
    void onlyAbsenceStatusesRequireNoteWhenPolicyEnabled() {
        assertTrue(AttendanceStatus.ABSENT.isAbsence());
        assertTrue(AttendanceStatus.EXCUSED.isAbsence());
        assertFalse(AttendanceStatus.PRESENT.isAbsence());
        assertFalse(AttendanceStatus.LATE.isAbsence());
    }

    @Test
    void bulkModeDefaultsToUpsert() {
        assertEquals(AttendanceBulkMode.UPSERT, AttendanceBulkMode.parse(null));
        assertEquals(AttendanceBulkMode.UPSERT, AttendanceBulkMode.parse(" "));
        assertEquals(AttendanceBulkMode.CREATE_ONLY, AttendanceBulkMode.parse("create_only"));
        assertNull(AttendanceBulkMode.parse("MERGE"));
    }
}
