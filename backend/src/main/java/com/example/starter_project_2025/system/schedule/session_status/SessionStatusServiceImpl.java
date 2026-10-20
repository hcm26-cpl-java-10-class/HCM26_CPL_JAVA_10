package com.example.starter_project_2025.system.schedule.session_status;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.crud.CalendarLock;
import jakarta.persistence.EntityManager;
import com.example.starter_project_2025.system.schedule.exception.ConflictException;
import com.example.starter_project_2025.system.schedule.exception.UnprocessableEntityException;
import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionAccessPolicy;
import com.example.starter_project_2025.system.schedule.session.SessionMapper;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.example.starter_project_2025.system.schedule.session.dto.SessionCancelRequest;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.system.schedule.session_audit.SessionStatusHistoryRecorder;
import com.example.starter_project_2025.system.schedule.session_status.dto.SessionCompleteRequest;
import com.example.starter_project_2025.system.schedule.session_status.dto.SessionStatusUpdateRequest;
import com.example.starter_project_2025.system.schedule.session_status.exception.SessionNotFoundException;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * F15 — Session Operational Status.
 *
 * <p>Life cycle: {@code SCHEDULED -> COMPLETED | CANCELLED} (cả hai là trạng thái terminal).</p>
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionStatusServiceImpl implements SessionStatusService {

    static final int MAX_CANCEL_REASON_LENGTH = 500;
    static final String CLASS_STATUS_ONGOING = "ONGOING";
    static final String CLASS_STATUS_ACTIVE = "ACTIVE";

    SessionRepository sessionRepository;
    SessionMapper sessionMapper;
    SessionAccessPolicy sessionAccessPolicy;
    ExternalApiService externalApiService;
    CalendarLock calendarLock;
    EntityManager entityManager;
    SessionStatusHistoryRecorder statusHistoryRecorder;

    // ------------------------------------------------------------------ read

    @Override
    @Transactional(readOnly = true)
    public SessionDTO getStatus(Long id) {
        Session session = loadSession(id);
        sessionAccessPolicy.requireReadScope(session);
        return sessionMapper.toResponse(session);
    }

    // ------------------------------------------------------- main endpoint

    @Override
    public SessionDTO changeStatus(Long id, SessionStatusUpdateRequest request, Long expectedVersion) {

        if (request == null || request.getStatus() == null) {
            throw UnprocessableEntityException.of(
                    "VALIDATION_FAILED",
                    "status",
                    "Trạng thái mới là bắt buộc (COMPLETED hoặc CANCELLED).");
        }

        SessionStatus target = request.getStatus();

        if (target == SessionStatus.COMPLETED) {
            return complete(id, SessionCompleteRequest.builder()
                    .notes(request.getNotes())
                    .version(request.getVersion())
                    .build(), expectedVersion);
        }

        if (target == SessionStatus.CANCELLED) {
            return cancel(id, SessionCancelRequest.builder()
                    .cancelReason(request.getCancelReason())
                    .notes(request.getNotes())
                    .version(request.getVersion())
                    .build(), expectedVersion);
        }

        throw UnprocessableEntityException.of(
                "VALIDATION_FAILED",
                "status",
                "Chỉ cho phép COMPLETED hoặc CANCELLED. Giá trị nhận được: " + target + ".");
    }

    // ---------------------------------------------------------- shortcuts

    @Override
    public SessionDTO complete(Long id, SessionCompleteRequest request, Long expectedVersion) {

        Session session = loadSessionForUpdate(id);
        sessionAccessPolicy.requireUpdateScope(session);

        requireVersion(session, expectedVersion);
        requireScheduled(session, "hoàn thành");
        requireActiveCalendarVersion(session);
        requireClassOngoing(session);
        requireStartTimeReached(session);

        SessionStatus fromStatus = session.getStatus();
        String beforeState = statusHistoryRecorder.snapshot(session);

        session.setStatus(SessionStatus.COMPLETED);
        if (request != null && request.getNotes() != null) {
            session.setNotes(request.getNotes());
        }
        Session saved = sessionRepository.saveAndFlush(session);
        // T2/AC — mọi lần chuyển trạng thái phải sinh 1 dòng session_status_history.
        statusHistoryRecorder.recordTransition(
                saved, fromStatus, SessionStatus.COMPLETED, null, beforeState);
        return sessionMapper.toResponse(saved);
    }

    @Override
    public SessionDTO cancel(Long id, SessionCancelRequest request, Long expectedVersion) {

        Session session = loadSessionForUpdate(id);
        sessionAccessPolicy.requireCancelScope();

        String reason = requireCancelReason(request != null ? request.getCancelReason() : null);

        requireVersion(session, expectedVersion);
        requireScheduled(session, "hủy");
        requireActiveCalendarVersion(session);

        SessionStatus fromStatus = session.getStatus();
        String beforeState = statusHistoryRecorder.snapshot(session);

        session.setStatus(SessionStatus.CANCELLED);
        session.setCancelReason(reason);
        if (request != null && request.getNotes() != null) {
            session.setNotes(request.getNotes());
        }
        Session saved = sessionRepository.saveAndFlush(session);
        // T2/AC — mọi lần chuyển trạng thái phải sinh 1 dòng session_status_history.
        statusHistoryRecorder.recordTransition(
                saved, fromStatus, SessionStatus.CANCELLED, reason, beforeState);
        return sessionMapper.toResponse(saved);
    }

    // ----------------------------------------------------------- helpers

    private Session loadSessionForUpdate(Long id) {
        Session session = loadSession(id);
        // Serialize against activate/clone and refresh values loaded before waiting for the lock.
        calendarLock.session(id);
        entityManager.refresh(session);
        if (!Boolean.TRUE.equals(session.getIsActive())) {
            throw new SessionNotFoundException(id);
        }
        return session;
    }

    private Session loadSession(Long id) {
        if (id == null || id <= 0) {
            throw new BadRequestException("Session ID must be positive.");
        }
        return sessionRepository.findByIdAndIsActiveTrue(id)
                .orElseThrow(() -> new SessionNotFoundException(id));
    }

    /**
     * Optimistic locking: If-Match/ETag hoặc field {@code version} trong body.
     */
    private void requireVersion(Session session, Long expectedVersion) {
        if (expectedVersion != null && !expectedVersion.equals(session.getVersion())) {
            throw new ConflictException(
                    "SESSION_VERSION_CONFLICT",
                    "Phiên bản buổi học đã thay đổi, vui lòng tải lại (currentVersion=" + session.getVersion() + ").");
        }
    }

    private void requireScheduled(Session session, String action) {
        if (session.getStatus() != SessionStatus.SCHEDULED) {
            throw new ConflictException(
                    "SESSION_INVALID_TRANSITION",
                    "Chỉ có thể " + action + " buổi học ở trạng thái SCHEDULED. Trạng thái hiện tại: "
                            + session.getStatus() + ".");
        }
    }

    private void requireActiveCalendarVersion(Session session) {
        CalendarVersion version = session.getCalendarVersion();
        if (version == null
                || version.getStatus() != CalendarVersionStatus.ACTIVE
                || !Boolean.TRUE.equals(version.getIsActive())) {
            throw new ConflictException(
                    "CALENDAR_VERSION_NOT_ACTIVE",
                    "Chỉ cập nhật trạng thái khi Calendar Version đang ACTIVE.");
        }
    }

    private void requireStartTimeReached(Session session) {
        if (session.getStartTime() == null || session.getStartTime().isAfter(LocalDateTime.now())) {
            throw new ConflictException(
                    "SESSION_INVALID_TRANSITION",
                    "Chỉ có thể hoàn thành buổi học khi đã tới giờ bắt đầu (startTime <= now).");
        }
    }

    /**
     * BR-UNI-08: lớp phải ONGOING. Trạng thái lớp nằm ở hệ thống ngoài; nếu không lấy được
     * (null/lỗi mạng) thì bỏ qua kiểm tra để không chặn thao tác (fail-open) và ghi log.
     */
    private void requireClassOngoing(Session session) {
        CalendarVersion version = session.getCalendarVersion();
        if (version == null || version.getCalendar() == null) {
            return;
        }
        Long classId = version.getCalendar().getClassId();
        if (classId == null) {
            return;
        }

        String classStatus;
        try {
            var classInfo = externalApiService.fetchClassById(classId);
            if (classInfo == null) {
                return;
            }
            classStatus = classInfo.getStatus();
        } catch (RuntimeException ex) {
            log.warn("Cannot resolve external class status for classId={}: {}", classId, ex.getMessage());
            return;
        }

        if (classStatus == null || classStatus.isBlank()) {
            return;
        }
        if (!CLASS_STATUS_ONGOING.equalsIgnoreCase(classStatus)
                && !CLASS_STATUS_ACTIVE.equalsIgnoreCase(classStatus)) {
            throw new ConflictException(
                    "CLASS_NOT_ONGOING",
                    "Chỉ cập nhật trạng thái khi lớp đang ONGOING. Trạng thái hiện tại: " + classStatus + ".");
        }
    }

    private String requireCancelReason(String rawReason) {
        if (rawReason == null || rawReason.isBlank()) {
            throw UnprocessableEntityException.of(
                    "VALIDATION_FAILED",
                    "cancelReason",
                    "Lý do hủy là bắt buộc khi hủy buổi học (BR-SES-03).");
        }
        String reason = rawReason.trim();
        if (reason.length() > MAX_CANCEL_REASON_LENGTH) {
            throw UnprocessableEntityException.of(
                    "VALIDATION_FAILED",
                    "cancelReason",
                    "Lý do hủy không được vượt quá " + MAX_CANCEL_REASON_LENGTH + " ký tự.");
        }
        return reason;
    }
}
