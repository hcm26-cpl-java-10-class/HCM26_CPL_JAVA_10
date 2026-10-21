package com.example.starter_project_2025.system.schedule.session.session_attendance;

import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * T1 — Dữ liệu mẫu cho màn hình điểm danh (SCR-53).
 *
 * <p>Seed của dự án chỉ tạo session ở <b>tương lai</b> (ngày mai/ngày kia) nên bảng điểm danh
 * luôn rỗng và API còn chặn ghi với {@code SESSION_DATE_IN_FUTURE} (BR-ATT-01). Initializer
 * này bảo đảm có dữ liệu để kiểm tra:</p>
 *
 * <ol>
 *     <li>Nếu đã có bản ghi điểm danh ⇒ bỏ qua (idempotent, không ghi đè dữ liệu thật).</li>
 *     <li>Tìm các session <b>đã diễn ra</b> (startTime ≤ hôm nay, không CANCELLED).</li>
 *     <li>Nếu chưa có, tạo 2 buổi học demo trong quá khứ trên Calendar Version đang ACTIVE
 *         (cùng lớp với seed hiện có) để có thể mở điểm danh và lưu được.</li>
 *     <li>Ghi bản ghi điểm danh cho 8 học viên với đủ 4 trạng thái, kèm 1 dòng history
 *         (CREATE), 1 dòng audit và 1 outbox event cho mỗi bản ghi — giống luồng thật.</li>
 * </ol>
 *
 * <p>Tắt bằng {@code attendance.demo.enabled=false}.</p>
 */
@Slf4j
@Component
@Order(13)
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AttendanceDemoDataInitializer implements CommandLineRunner {

    static final String ENTITY_TYPE = "ATTENDANCE";
    static final int MAX_SESSIONS_TO_SEED = 3;

    AttendanceRepository attendanceRepository;
    AttendanceHistoryRepository historyRepository;
    AttendanceAuditLogRepository auditLogRepository;
    AttendanceOutboxEventRepository outboxRepository;
    SessionRepository sessionRepository;
    CalendarRepository calendarRepository;
    CalendarVersionRepository calendarVersionRepository;
    UserRepository userRepository;
    ObjectMapper objectMapper;

    @NonFinal
    @Value("${attendance.demo.enabled:true}")
    boolean demoEnabled;

    @NonFinal
    @Value("${app.seed.admin.email:admin@example.com}")
    String adminEmail;

    @Override
    @Transactional
    public void run(String... args) {
        if (!demoEnabled) {
            return;
        }

        Long actorId = userRepository.findByEmail(adminEmail).map(User::getId).orElse(1L);
        User trainer = userRepository.findByEmail("teacher@example.com").orElse(null);
        Long trainerId = trainer != null ? trainer.getId() : actorId;
        String trainerName = trainer != null
                ? trainer.getFullName()
                : "Nguyen Minh (Trainer)";

        // Chỉ seed cho session đã diễn ra và chưa có bản ghi (idempotent, không ghi đè dữ liệu thật).
        List<Session> sessions = findPastSessions();
        if (sessions.isEmpty()) {
            sessions = createPastDemoSessions(trainerId, trainerName);
        }

        List<Session> targets = sessions.stream()
                .filter(session -> attendanceRepository
                        .countBySessionIdAndIsActiveTrue(session.getId()) == 0)
                .toList();
        if (targets.isEmpty()) {
            log.info("Attendance demo data already present for all past sessions — skip seeding.");
            return;
        }

        int seeded = 0;
        for (Session session : targets) {
            seeded += seedSession(session, actorId);
        }
        log.info("Seeded {} attendance demo records for {} past session(s): {}", seeded, targets.size(),
                targets.stream().map(session -> session.getId() + " (" + session.getTitle() + ")").toList());
    }

    /**
     * Các session đã diễn ra, mới nhất trước — chỉ lấy tối đa {@value #MAX_SESSIONS_TO_SEED}.
     */
    private List<Session> findPastSessions() {
        LocalDate today = LocalDate.now();
        return sessionRepository.findAll().stream()
                .filter(session -> Boolean.TRUE.equals(session.getIsActive()))
                .filter(session -> session.getStatus() != SessionStatus.CANCELLED)
                .filter(session -> session.getStartTime() != null)
                .filter(session -> !session.getStartTime().toLocalDate().isAfter(today))
                .sorted(Comparator.comparing(Session::getStartTime).reversed())
                .limit(MAX_SESSIONS_TO_SEED)
                .toList();
    }

    /**
     * Tạo 2 buổi học demo đã diễn ra để có thể điểm danh ngay khi mở app.
     */
    private List<Session> createPastDemoSessions(Long trainerId, String trainerName) {
        CalendarVersion version = findActiveCalendarVersion();
        if (version == null) {
            return List.of();
        }

        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDate lastWeek = LocalDate.now().minusDays(5);

        List<Session> created = new ArrayList<>();
        created.add(sessionRepository.save(Session.builder()
                .calendarVersion(version)
                .classCode("HCM26-FSJ-01")
                .topicName("Java Spring Framework")
                .title("Java Spring Core & RESTful API — Session 1 (past)")
                .trainerId(trainerId)
                .trainerName(trainerName)
                .startTime(LocalDateTime.of(yesterday, LocalTime.of(8, 30)))
                .endTime(LocalDateTime.of(yesterday, LocalTime.of(11, 30)))
                .room("Room A-301")
                .meetingLink("https://meet.google.com/fsj-session1")
                .status(SessionStatus.SCHEDULED)
                .notes("Past demo session — use it to try the attendance sheet.")
                .isOverridden(false)
                .isActive(true)
                .build()));

        created.add(sessionRepository.save(Session.builder()
                .calendarVersion(version)
                .classCode("HN26-QAA-02")
                .topicName("QA Automation")
                .title("Selenium WebDriver & TestNG Basics — Session 1 (past)")
                .trainerId(trainerId)
                .trainerName(trainerName)
                .startTime(LocalDateTime.of(lastWeek, LocalTime.of(13, 30)))
                .endTime(LocalDateTime.of(lastWeek, LocalTime.of(16, 30)))
                .room("Room B-202")
                .meetingLink("https://meet.google.com/qaa-session2")
                .status(SessionStatus.SCHEDULED)
                .notes("Past demo session — use it to try the attendance history.")
                .isOverridden(false)
                .isActive(true)
                .build()));

        log.info("Created {} past demo session(s) for attendance seeding.", created.size());
        return created;
    }

    private CalendarVersion findActiveCalendarVersion() {
        List<Calendar> calendars = calendarRepository.findByIsActiveTrue();
        if (calendars.isEmpty()) {
            return null;
        }
        List<Long> calendarIds = calendars.stream().map(Calendar::getId).toList();
        return calendarVersionRepository
                .findByCalendar_IdInAndStatusAndIsActiveTrue(calendarIds, CalendarVersionStatus.ACTIVE)
                .stream()
                .findFirst()
                .orElse(null);
    }

    private int seedSession(Session session, Long actorId) {
        Long classId = session.getClassId();
        if (classId == null || session.getStartTime() == null) {
            return 0;
        }

        LocalDate attendanceDate = session.getStartTime().toLocalDate();
        LocalDateTime recordedAt = session.getEndTime() != null
                ? session.getEndTime()
                : session.getStartTime();
        String correlationId = UUID.randomUUID().toString();
        int created = 0;

        for (Long studentId : AttendanceDemoData.studentIds()) {
            AttendanceStatus status = AttendanceDemoData.statusFor(studentId);
            String note = AttendanceDemoData.noteFor(status);

            Attendance attendance = Attendance.builder()
                    .sessionId(session.getId())
                    .classId(classId)
                    .calendarVersionId(session.getCalendarVersionId())
                    .studentId(studentId)
                    .status(status)
                    .note(note)
                    .attendanceDate(attendanceDate)
                    .membershipStatus(AttendanceMembershipStatus.ACTIVE)
                    .isActive(Boolean.TRUE)
                    .build();
            attendance.setCreatedBy(actorId);
            attendance.setUpdatedBy(actorId);
            Attendance saved = attendanceRepository.saveAndFlush(attendance);

            historyRepository.save(AttendanceHistory.builder()
                    .attendanceId(saved.getId())
                    .sessionId(saved.getSessionId())
                    .studentId(saved.getStudentId())
                    .action(AttendanceHistoryAction.CREATE)
                    .fromStatus(null)
                    .toStatus(status)
                    .fromNote(null)
                    .toNote(note)
                    .versionBefore(null)
                    .versionAfter(saved.versionOrZero())
                    .reason(null)
                    .changedBy(actorId)
                    .changedAt(recordedAt)
                    .correlationId(correlationId)
                    .idempotencyKey(null)
                    .build());

            auditLogRepository.save(AttendanceAuditLog.builder()
                    .actorId(actorId)
                    .action(AttendanceAuditAction.ATTENDANCE_RECORDED)
                    .entityType(ENTITY_TYPE)
                    .entityId(saved.getId())
                    .beforeState(null)
                    .afterState(snapshot(saved))
                    .reason(null)
                    .correlationId(correlationId)
                    .idempotencyKey(null)
                    .createdAt(recordedAt)
                    .build());

            outboxRepository.save(AttendanceOutboxEvent.builder()
                    .eventType(AttendanceOutboxEventType.ATTENDANCE_RECORDED)
                    .aggregateType(ENTITY_TYPE)
                    .aggregateId(saved.getId())
                    .payload(snapshot(saved))
                    .status(AttendanceOutboxStatus.PENDING)
                    .dedupKey(AttendanceOutboxEventType.ATTENDANCE_RECORDED.name()
                            + ":" + saved.getId() + ":" + saved.versionOrZero())
                    .correlationId(correlationId)
                    .occurredAt(recordedAt)
                    .attempts(0)
                    .build());

            created++;
        }
        return created;
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
            log.warn("Cannot serialize demo attendance snapshot id={}: {}",
                    attendance.getId(), ex.getMessage());
            return null;
        }
    }
}
