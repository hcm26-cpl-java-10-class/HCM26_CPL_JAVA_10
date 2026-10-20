package com.example.starter_project_2025.system.schedule.session_audit;

import com.example.starter_project_2025.system.schedule.session.Session;
import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.example.starter_project_2025.system.schedule.session_audit.entity.SessionAuditLog;
import com.example.starter_project_2025.system.schedule.session_audit.entity.SessionStatusHistory;
import com.example.starter_project_2025.system.schedule.session_audit.repository.SessionAuditLogRepository;
import com.example.starter_project_2025.system.schedule.session_audit.repository.SessionStatusHistoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.AuditorAware;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Ghi {@code session_status_history} + {@code session_audit_log} cho mọi lần chuyển trạng thái.
 *
 * <p>Được dùng chung bởi các luồng thay đổi trạng thái ({@code PATCH /status},
 * {@code POST /complete}, {@code POST /cancel}, {@code PATCH /notes}) để màn
 * "Lịch sử trạng thái" luôn có dữ liệu bất kể client gọi endpoint nào.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionStatusHistoryRecorder {

    static final String ENTITY_TYPE_SESSION = "SESSION";

    /** Dùng khi không xác định được người thực hiện (job nội bộ, test). */
    static final long SYSTEM_ACTOR_ID = 0L;

    SessionStatusHistoryRepository historyRepository;
    SessionAuditLogRepository auditLogRepository;
    ObjectMapper objectMapper;
    AuditorAware<Long> auditorAware;

    /**
     * Snapshot JSON của buổi học dùng cho {@code beforeState}/{@code afterState} của audit log.
     */
    public String snapshot(Session session) {
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

    /**
     * Ghi 1 dòng history bất biến + 1 dòng audit log cho một lần chuyển trạng thái.
     *
     * @param session     entity đã được persist và flush (cần có id, version, updatedAt)
     * @param fromStatus  trạng thái trước khi đổi
     * @param toStatus    trạng thái sau khi đổi
     * @param reason      lý do (bắt buộc với CANCELLED, có thể null với COMPLETED)
     * @param beforeState snapshot JSON trước khi đổi
     * @return id của dòng history, hoặc {@code null} nếu không có chuyển trạng thái
     */
    public Long recordTransition(Session session,
                                 SessionStatus fromStatus,
                                 SessionStatus toStatus,
                                 String reason,
                                 String beforeState) {
        if (session == null || session.getId() == null
                || toStatus == null || toStatus == fromStatus) {
            return null;
        }

        Long actorId = currentActorId();
        LocalDateTime changedAt = session.getUpdatedAt() != null
                ? session.getUpdatedAt()
                : LocalDateTime.now();
        String correlationId = CorrelationContext.getOrCreate();

        SessionStatusHistory history = historyRepository.saveAndFlush(SessionStatusHistory.builder()
                .sessionId(session.getId())
                .fromStatus(fromStatus)
                .toStatus(toStatus)
                .reason(reason)
                .changedBy(actorId)
                .changedAt(changedAt)
                .correlationId(correlationId)
                .build());

        auditLogRepository.saveAndFlush(SessionAuditLog.builder()
                .actorId(actorId)
                .action(SessionAuditAction.SESSION_STATUS_CHANGE)
                .entityType(ENTITY_TYPE_SESSION)
                .entityId(session.getId())
                .beforeState(beforeState)
                .afterState(snapshot(session))
                .reason(reason)
                .correlationId(correlationId)
                .createdAt(changedAt)
                .build());

        log.info("session.status.changed sessionId={} {}->{} actor={} historyId={} correlationId={}",
                session.getId(), fromStatus, toStatus, actorId, history.getId(), correlationId);
        return history.getId();
    }

    private Long currentActorId() {
        return auditorAware.getCurrentAuditor().orElse(SYSTEM_ACTOR_ID);
    }
}
