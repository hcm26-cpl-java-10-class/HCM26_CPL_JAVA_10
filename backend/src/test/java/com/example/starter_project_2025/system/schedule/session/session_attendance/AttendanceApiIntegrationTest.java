package com.example.starter_project_2025.system.schedule.session.session_attendance;

import com.example.starter_project_2025.StarterProject2025Application;
import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * T1 — Integration test cho UFR-PEO-016 (AC T1-01 → T1-07).
 *
 * <p>Chạy full application với H2 + JWT filter thật; contract nguồn (class/roster) được mock
 * để mô phỏng từng tình huống nghiệp vụ: lớp ONGOING/COMPLETED/PLANNING, học viên ACTIVE/
 * NOT_IN_CLASS, ánh xạ trainee ⇒ studentId.</p>
 */
@SpringBootTest(classes = StarterProject2025Application.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:attendance_api_test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=false",
        "logging.level.org.hibernate.SQL=OFF",
        "app.seed.admin.email=attendance-admin@example.com",
        "app.seed.admin.password=attendance-test-password"
})
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AttendanceApiIntegrationTest {

    static final long STUDENT_ID = 2001L;
    static final long SECOND_STUDENT_ID = 2002L;
    static final long THIRD_STUDENT_ID = 2003L;

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired CalendarRepository calendars;
    @Autowired CalendarVersionRepository versions;
    @Autowired SessionRepository sessions;
    @Autowired UserRepository users;
    @Autowired AttendanceRepository attendances;
    @Autowired AttendanceHistoryRepository histories;
    @Autowired AttendanceAuditLogRepository auditLogs;
    @Autowired AttendanceOutboxEventRepository outbox;

    @MockBean AttendanceContractGateway contract;

    private final AtomicLong classIds = new AtomicLong(910000);
    private Long adminId;
    private Long teacherId;
    private Long studentUserId;
    private String adminToken;
    private String teacherToken;
    private String studentToken;

    @BeforeAll
    void loginWithSeededAccounts() throws Exception {
        adminId = users.findByEmail("attendance-admin@example.com").orElseThrow().getId();
        teacherId = users.findByEmail("teacher@example.com").orElseThrow().getId();
        studentUserId = users.findByEmail("student@example.com").orElseThrow().getId();
        adminToken = login("attendance-admin@example.com", "attendance-test-password");
        teacherToken = login("teacher@example.com", "password123");
        studentToken = login("student@example.com", "password123");
    }

    @BeforeEach
    void stubContractDefaults() {
        when(contract.loadClass(anyLong()))
                .thenReturn(AttendanceContractGateway.ClassSnapshot.available("ONGOING"));
        when(contract.loadMembership(anyLong(), anyLong(), any()))
                .thenReturn(AttendanceContractGateway.MembershipSnapshot.of(AttendanceMembershipStatus.ACTIVE));
        when(contract.resolveStudentIdForActor(anyLong())).thenReturn(Optional.empty());
    }

    // ============================================================ AC T1-01/02

    @Test
    void createAndUpdateRecordWithFullAuditTrail() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);

        JsonNode created = read(create(adminToken, fixture.session().getId(), STUDENT_ID, "PRESENT", "create-1")
                .andExpect(status().isCreated())
                .andExpect(header().exists("ETag"))
                .andExpect(header().exists("X-Correlation-Id"))
                .andExpect(jsonPath("$.sessionId").value(fixture.session().getId()))
                .andExpect(jsonPath("$.classId").value(fixture.calendar().getClassId()))
                .andExpect(jsonPath("$.calendarVersionId").value(fixture.version().getId()))
                .andExpect(jsonPath("$.studentId").value(STUDENT_ID))
                .andExpect(jsonPath("$.status").value("PRESENT"))
                .andExpect(jsonPath("$.attendanceDate").value(LocalDate.now().minusDays(1).toString()))
                .andExpect(jsonPath("$.recordedBy").value(adminId))
                .andExpect(jsonPath("$.recordedAt").exists())
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.locked").value(false)));

        long attendanceId = created.path("id").asLong();
        assertEquals(1, histories.findByAttendanceIdOrderByChangedAtAscIdAsc(attendanceId).size());
        assertEquals(1, auditLogs.countByEntityTypeAndEntityId("ATTENDANCE", attendanceId));
        assertEquals(1, outbox.findByAggregateIdOrderByOccurredAtAscIdAsc(attendanceId).size());

        read(mvc.perform(get("/api/v1/attendance-records/{id}", attendanceId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PRESENT")));

        read(mvc.perform(patch("/api/v1/attendance-records/{id}", attendanceId)
                        .header("Authorization", "Bearer " + adminToken)
                        .header("If-Match", "0")
                        .header("Idempotency-Key", "update-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"LATE\",\"note\":\"Đi muộn 10 phút\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LATE"))
                .andExpect(jsonPath("$.note").value("Đi muộn 10 phút"))
                .andExpect(jsonPath("$.version").value(1)));

        List<AttendanceHistory> trail = histories.findByAttendanceIdOrderByChangedAtAscIdAsc(attendanceId);
        assertEquals(2, trail.size());
        assertEquals(AttendanceHistoryAction.UPDATE, trail.get(1).getAction());
        assertEquals(AttendanceStatus.PRESENT, trail.get(1).getFromStatus());
        assertEquals(AttendanceStatus.LATE, trail.get(1).getToStatus());
        assertEquals(2, auditLogs.countByEntityTypeAndEntityId("ATTENDANCE", attendanceId));
        assertEquals(2, outbox.findByAggregateIdOrderByOccurredAtAscIdAsc(attendanceId).size());

        read(mvc.perform(get("/api/v1/attendance-records/{id}/history", attendanceId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].action").value("CREATE"))
                .andExpect(jsonPath("$[1].action").value("UPDATE")));
    }

    @Test
    void updateWithStaleVersionReturnsVersionConflict() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);
        long attendanceId = read(create(adminToken, fixture.session().getId(), STUDENT_ID, "PRESENT", null)
                .andExpect(status().isCreated())).path("id").asLong();

        mvc.perform(patch("/api/v1/attendance-records/{id}", attendanceId)
                        .header("Authorization", "Bearer " + adminToken)
                        .header("If-Match", "5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ABSENT\",\"note\":\"Không phép\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ATTENDANCE_VERSION_CONFLICT"))
                .andExpect(jsonPath("$.currentVersion").value(0));
    }

    @Test
    void duplicateRecordIsRejectedWith409() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);
        create(adminToken, fixture.session().getId(), STUDENT_ID, "PRESENT", null)
                .andExpect(status().isCreated());

        create(adminToken, fixture.session().getId(), STUDENT_ID, "ABSENT", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ATTENDANCE_DUPLICATE"))
                .andExpect(jsonPath("$.currentVersion").value(0));
    }

    // ============================================================== AC T1-03

    @Test
    void invalidPayloadReturns422WithoutPersisting() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);

        mvc.perform(post("/api/v1/attendance-records")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":" + fixture.session().getId()
                                + ",\"status\":\"PRESENTT\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.studentId").exists())
                .andExpect(jsonPath("$.fieldErrors.status").exists());

        mvc.perform(post("/api/v1/attendance-records")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":" + fixture.session().getId()
                                + ",\"studentId\":" + STUDENT_ID
                                + ",\"status\":\"PRESENT\",\"note\":\"" + "x".repeat(501) + "\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.note").exists());

        mvc.perform(post("/api/v1/attendance-records")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":" + fixture.session().getId()
                                + ",\"studentId\":" + STUDENT_ID
                                + ",\"status\":\"PRESENT\",\"recordedBy\":99,\"attendanceDate\":\"2020-01-01\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.recordedBy").exists())
                .andExpect(jsonPath("$.fieldErrors.attendanceDate").exists());

        assertTrue(attendances.findBySessionIdAndIsActiveTrueOrderByStudentIdAsc(fixture.session().getId())
                .isEmpty());
    }

    @Test
    void futureSessionCannotBeRecorded() throws Exception {
        Fixture fixture = fixture(LocalDate.now().plusDays(2), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);

        create(adminToken, fixture.session().getId(), STUDENT_ID, "PRESENT", null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("SESSION_DATE_IN_FUTURE"));
    }

    @Test
    void cancelledSessionIsRejected() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.CANCELLED,
                CalendarVersionStatus.ACTIVE, adminId);

        create(adminToken, fixture.session().getId(), STUDENT_ID, "PRESENT", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SESSION_CANCELLED"));
    }

    @Test
    void nonActiveCalendarVersionIsRejected() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.DRAFT, adminId);

        create(adminToken, fixture.session().getId(), STUDENT_ID, "PRESENT", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CALENDAR_VERSION_NOT_ACTIVE"));
    }

    @Test
    void classNotOngoingIsRejected() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);
        when(contract.loadClass(fixture.calendar().getClassId()))
                .thenReturn(AttendanceContractGateway.ClassSnapshot.available("PLANNING"));

        create(adminToken, fixture.session().getId(), STUDENT_ID, "PRESENT", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CLASS_NOT_ONGOING"));
    }

    @Test
    void membershipIsValidatedAgainstRosterContract() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);
        when(contract.loadMembership(anyLong(), eq(SECOND_STUDENT_ID), any()))
                .thenReturn(AttendanceContractGateway.MembershipSnapshot.of(
                        AttendanceMembershipStatus.NOT_IN_CLASS));
        when(contract.loadMembership(anyLong(), eq(THIRD_STUDENT_ID), any()))
                .thenReturn(AttendanceContractGateway.MembershipSnapshot.of(
                        AttendanceMembershipStatus.INACTIVE));

        create(adminToken, fixture.session().getId(), SECOND_STUDENT_ID, "PRESENT", null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("STUDENT_NOT_IN_CLASS"));

        create(adminToken, fixture.session().getId(), THIRD_STUDENT_ID, "PRESENT", null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("STUDENT_NOT_ACTIVE"));
    }

    // ============================================================== AC T1-04/03

    @Test
    void lockedClassRequiresUnlockPermissionAndReason() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.COMPLETED,
                CalendarVersionStatus.ACTIVE, teacherId);
        long attendanceId = read(create(adminToken, fixture.session().getId(), STUDENT_ID, "ABSENT", null)
                .andExpect(status().isCreated())).path("id").asLong();

        when(contract.loadClass(fixture.calendar().getClassId()))
                .thenReturn(AttendanceContractGateway.ClassSnapshot.available("COMPLETED"));

        // Trainer không có ATTENDANCE_UNLOCK → 409 ATTENDANCE_LOCKED.
        mvc.perform(patch("/api/v1/attendance-records/{id}", attendanceId)
                        .header("Authorization", "Bearer " + teacherToken)
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PRESENT\",\"reason\":\"Sửa theo biên bản\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ATTENDANCE_LOCKED"));

        // Class Admin có unlock nhưng thiếu lý do → 422.
        mvc.perform(put("/api/v1/attendance-records/{id}", attendanceId)
                        .header("Authorization", "Bearer " + adminToken)
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PRESENT\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.reason").exists());

        // Class Admin có unlock + lý do → 200, history ghi CORRECTION.
        mvc.perform(put("/api/v1/attendance-records/{id}", attendanceId)
                        .header("Authorization", "Bearer " + adminToken)
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PRESENT\",\"reason\":\"Sửa theo biên bản\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PRESENT"))
                .andExpect(jsonPath("$.locked").value(true))
                .andExpect(jsonPath("$.version").value(1));

        List<AttendanceHistory> trail = histories.findByAttendanceIdOrderByChangedAtAscIdAsc(attendanceId);
        assertEquals(AttendanceHistoryAction.CORRECTION, trail.get(trail.size() - 1).getAction());
        assertEquals("Sửa theo biên bản", trail.get(trail.size() - 1).getReason());
    }

    // ============================================================== AC T1-05/06

    @Test
    void bulkReturnsPerRowResultsAndWritesSuccessfulRows() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);
        when(contract.loadMembership(anyLong(), eq(SECOND_STUDENT_ID), any()))
                .thenReturn(AttendanceContractGateway.MembershipSnapshot.of(
                        AttendanceMembershipStatus.NOT_IN_CLASS));

        read(mvc.perform(post("/api/v1/sessions/{id}/attendance:bulk", fixture.session().getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .header("Idempotency-Key", "bulk-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mode":"UPSERT","items":[
                                  {"studentId":2001,"status":"PRESENT"},
                                  {"studentId":2002,"status":"ABSENT","note":"Không phép"},
                                  {"studentId":2003,"status":"LATE"}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.created").value(2))
                .andExpect(jsonPath("$.rejected").value(1))
                .andExpect(jsonPath("$.results[1].result").value("REJECTED"))
                .andExpect(jsonPath("$.results[1].code").value("STUDENT_NOT_IN_CLASS"))
                .andExpect(jsonPath("$.results[2].result").value("CREATED")));

        assertEquals(2, attendances.findBySessionIdAndIsActiveTrueOrderByStudentIdAsc(
                fixture.session().getId()).size());

        // UPSERT với version đúng → UPDATED; version sai → REJECTED kèm currentVersion.
        mvc.perform(post("/api/v1/sessions/{id}/attendance:bulk", fixture.session().getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mode":"UPSERT","items":[
                                  {"studentId":2001,"status":"LATE","version":0},
                                  {"studentId":2003,"status":"PRESENT","version":9}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updated").value(1))
                .andExpect(jsonPath("$.rejected").value(1))
                .andExpect(jsonPath("$.results[1].code").value("ATTENDANCE_VERSION_CONFLICT"))
                .andExpect(jsonPath("$.results[1].currentVersion").value(0));
    }

    @Test
    void bulkValidationAndCreateOnlyMode() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);

        mvc.perform(post("/api/v1/sessions/{id}/attendance:bulk", fixture.session().getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"UPSERT\",\"items\":[]}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.items").exists());

        mvc.perform(post("/api/v1/sessions/{id}/attendance:bulk", fixture.session().getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mode":"UPSERT","items":[
                                  {"studentId":2001,"status":"PRESENT"},
                                  {"studentId":2001,"status":"LATE"}]}
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors['items[1].studentId']").exists());

        create(adminToken, fixture.session().getId(), STUDENT_ID, "PRESENT", null)
                .andExpect(status().isCreated());

        mvc.perform(post("/api/v1/sessions/{id}/attendance:bulk", fixture.session().getId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mode":"CREATE_ONLY","items":[{"studentId":2001,"status":"PRESENT"}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rejected").value(1))
                .andExpect(jsonPath("$.results[0].code").value("ATTENDANCE_DUPLICATE"));
    }

    @Test
    void repeatedIdempotencyKeyReplaysFirstResult() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);

        JsonNode first = read(create(adminToken, fixture.session().getId(), STUDENT_ID, "PRESENT", "same-key")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.idempotentReplay").value(false)));
        JsonNode second = read(create(adminToken, fixture.session().getId(), STUDENT_ID, "PRESENT", "same-key")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.idempotentReplay").value(true)));

        assertEquals(first.path("id").asLong(), second.path("id").asLong());
        long attendanceId = first.path("id").asLong();
        assertEquals(1, histories.findByAttendanceIdOrderByChangedAtAscIdAsc(attendanceId).size());
        assertEquals(1, outbox.findByAggregateIdOrderByOccurredAtAscIdAsc(attendanceId).size());

        // Cùng key nhưng payload khác → 409 IDEMPOTENCY_KEY_REUSED.
        create(adminToken, fixture.session().getId(), STUDENT_ID, "ABSENT", "same-key")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    // ================================================================== SCR-53

    @Test
    void sessionSheetReturnsCountersAndEmptyState() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);

        mvc.perform(get("/api/v1/sessions/{id}/attendance", fixture.session().getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.records.length()").value(0))
                .andExpect(jsonPath("$.locked").value(false));

        create(adminToken, fixture.session().getId(), STUDENT_ID, "PRESENT", null)
                .andExpect(status().isCreated());
        create(adminToken, fixture.session().getId(), SECOND_STUDENT_ID, "ABSENT", "Không phép")
                .andExpect(status().isCreated());

        mvc.perform(get("/api/v1/sessions/{id}/attendance", fixture.session().getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.present").value(1))
                .andExpect(jsonPath("$.absent").value(1))
                .andExpect(jsonPath("$.records.length()").value(2));
    }

    // ============================================================ permissions

    @Test
    void traineeCannotWriteAndOnlyReadsOwnRecord() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);
        long ownRecordId = read(create(adminToken, fixture.session().getId(), STUDENT_ID, "PRESENT", null)
                .andExpect(status().isCreated())).path("id").asLong();
        long otherRecordId = read(create(adminToken, fixture.session().getId(), SECOND_STUDENT_ID, "PRESENT", null)
                .andExpect(status().isCreated())).path("id").asLong();

        create(studentToken, fixture.session().getId(), STUDENT_ID, "PRESENT", null)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mvc.perform(get("/api/v1/sessions/{id}/attendance", fixture.session().getId())
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());

        when(contract.resolveStudentIdForActor(studentUserId)).thenReturn(Optional.of(STUDENT_ID));

        mvc.perform(get("/api/v1/attendance-records/{id}", ownRecordId)
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentId").value(STUDENT_ID));

        mvc.perform(get("/api/v1/attendance-records/{id}", otherRecordId)
                        .header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void trainerOutsideScopeIsForbidden() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);

        create(teacherToken, fixture.session().getId(), STUDENT_ID, "PRESENT", null)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    // ================================================================== 404

    @Test
    void unknownSessionAndRecordReturn404() throws Exception {
        create(adminToken, 999_999_999L, STUDENT_ID, "PRESENT", null)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));

        mvc.perform(patch("/api/v1/attendance-records/{id}", 888_888_888L)
                        .header("Authorization", "Bearer " + adminToken)
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PRESENT\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ATTENDANCE_NOT_FOUND"));
    }

    // ============================================================ demo seeding

    @Test
    void demoSeedCreatesSampleAttendanceIdempotently() throws Exception {
        Fixture fixture = fixture(LocalDate.now().minusDays(1), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);

        mvc.perform(post("/api/v1/sessions/{id}/attendance:demo-seed", fixture.session().getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(8))
                .andExpect(jsonPath("$.skipped").value(0))
                .andExpect(jsonPath("$.records.length()").value(8));

        mvc.perform(get("/api/v1/sessions/{id}/attendance", fixture.session().getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(8))
                .andExpect(jsonPath("$.present").value(4))
                .andExpect(jsonPath("$.late").value(1))
                .andExpect(jsonPath("$.absent").value(2))
                .andExpect(jsonPath("$.excused").value(1));

        // Second call only reports the existing rows — no duplicate record/history row.
        mvc.perform(post("/api/v1/sessions/{id}/attendance:demo-seed", fixture.session().getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(0))
                .andExpect(jsonPath("$.skipped").value(8));
    }

    @Test
    void demoSeedRejectsFutureSession() throws Exception {
        Fixture fixture = fixture(LocalDate.now().plusDays(2), SessionStatus.SCHEDULED,
                CalendarVersionStatus.ACTIVE, adminId);

        mvc.perform(post("/api/v1/sessions/{id}/attendance:demo-seed", fixture.session().getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("SESSION_DATE_IN_FUTURE"));
    }

    // =============================================================== helpers

    private String login(String email, String password) throws Exception {
        return read(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.createObjectNode().put("email", email).put("password", password).toString()))
                .andExpect(status().isOk())).path("accessToken").asText();
    }

    private ResultActions create(String token, long sessionId, long studentId, String status, String key)
            throws Exception {
        MockHttpServletRequestBuilder builder = post("/api/v1/attendance-records")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sessionId\":%d,\"studentId\":%d,\"status\":\"%s\"}"
                        .formatted(sessionId, studentId, status));
        if (key != null) {
            builder.header("Idempotency-Key", key);
        }
        return mvc.perform(builder.header("Authorization", "Bearer " + token));
    }

    private JsonNode read(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private Fixture fixture(LocalDate date,
                            SessionStatus sessionStatus,
                            CalendarVersionStatus versionStatus,
                            Long trainerId) {
        Calendar calendar = calendars.save(Calendar.builder()
                .classId(classIds.incrementAndGet())
                .name("Attendance fixture")
                .isActive(Boolean.TRUE)
                .build());
        CalendarVersion version = versions.save(CalendarVersion.builder()
                .calendar(calendar)
                .versionNumber(1)
                .status(versionStatus)
                .isActive(Boolean.TRUE)
                .build());
        LocalDateTime start = date.atTime(8, 0);
        Session session = sessions.save(Session.builder()
                .calendarVersion(version)
                .classCode("ATT-" + calendar.getClassId())
                .topicName("Attendance")
                .trainerId(trainerId)
                .trainerName("Trainer")
                .title("Attendance session")
                .startTime(start)
                .endTime(start.plusHours(2))
                .status(sessionStatus)
                .isActive(Boolean.TRUE)
                .build());
        return new Fixture(session, calendar, version);
    }

    private record Fixture(Session session, Calendar calendar, CalendarVersion version) {
    }
}
