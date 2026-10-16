package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.dto.ConflictCheckResponse;
import com.example.starter_project_2025.system.schedule.dto.SessionCancelRequest;
import com.example.starter_project_2025.system.schedule.exception.ConflictException;
import com.example.starter_project_2025.system.schedule.exception.UnprocessableEntityException;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionServiceImpl
        extends BaseCrudServiceImpl<Session, Long, SessionDTO, SessionFilter>
        implements SessionService {

    SessionMapper sessionMapper;
    SessionRepository sessionRepository;

    static DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

    static final int MAX_CANCEL_REASON_LENGTH = 500;

    @Override
    protected BaseCrudRepository<Session, Long> getRepository() {
        return sessionRepository;
    }

    @Override
    protected BaseCrudMapper<Session, SessionDTO> getMapper() {
        return sessionMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"title", "classCode", "topicName", "trainerName", "room"};
    }

    @Override
    protected void beforeCreate(Session entity, SessionDTO request, ValidationContext ctx) {
        if (entity.getStatus() == null) {
            entity.setStatus(request.getStatus() != null ? request.getStatus() : SessionStatus.SCHEDULED);
        }
        validateSession(entity, request, ctx, null);
    }

    @Override
    protected void beforeUpdate(Session entity, SessionDTO request, ValidationContext ctx) {
        validateSession(entity, request, ctx, entity.getId());
    }

    private void validateSession(Session entity, SessionDTO request, ValidationContext ctx, Long excludeId) {
        // 1. Kiểm tra BR-02: End time không được trước start time
        if (request.getStartTime() == null || request.getEndTime() == null) {
            ctx.add("time", "Thời gian bắt đầu và kết thúc không được để trống.");
            return;
        }

        if (!request.getEndTime().isAfter(request.getStartTime())) {
            ctx.add("endTime", "Thời gian kết thúc phải diễn ra sau thời gian bắt đầu (BR-02).");
            return;
        }

        // 2. Kiểm tra FR-CAL-03: Kiểm tra xung đột lịch
        List<Session> conflicts = sessionRepository.findConflictingSessions(
                request.getTrainerId(),
                request.getRoom(),
                request.getMeetingLink(),
                request.getStartTime(),
                request.getEndTime(),
                excludeId
        );

        if (!conflicts.isEmpty()) {
            if (Boolean.TRUE.equals(request.getForceOverride())) {
                // Kiểm tra BR-10: Bắt buộc phải có lý do khi override
                if (request.getOverrideReason() == null || request.getOverrideReason().trim().isEmpty()) {
                    ctx.add("overrideReason", "Bắt buộc phải nhập lý do khi override lịch trùng (BR-10).");
                } else {
                    String reason = request.getOverrideReason().trim();
                    entity.setIsOverridden(true);
                    entity.setOverrideReason(reason);
                    request.setIsOverridden(true);
                    request.setOverrideReason(reason);
                }
            } else {
                // Không có cờ override -> Chặn và trả về thông tin chi tiết các buổi bị trùng
                Session firstConflict = conflicts.get(0);
                String conflictCause = buildConflictDescription(request, firstConflict);
                ctx.add("conflict", conflictCause);
            }
        } else {
            // Không có conflict thì đặt lại cờ nếu trước đó chưa override
            if (Boolean.FALSE.equals(request.getForceOverride())) {
                entity.setIsOverridden(false);
                entity.setOverrideReason(null);
                request.setIsOverridden(false);
                request.setOverrideReason(null);
            }
        }
    }

    @Override
    public ConflictCheckResponse checkConflict(SessionDTO request, Long excludeId) {
        if (request.getStartTime() == null || request.getEndTime() == null || !request.getEndTime().isAfter(request.getStartTime())) {
            return ConflictCheckResponse.builder()
                    .hasConflict(false)
                    .message("Thời gian không hợp lệ để kiểm tra xung đột.")
                    .build();
        }

        List<Session> conflicts = sessionRepository.findConflictingSessions(
                request.getTrainerId(),
                request.getRoom(),
                request.getMeetingLink(),
                request.getStartTime(),
                request.getEndTime(),
                excludeId
        );

        if (conflicts.isEmpty()) {
            return ConflictCheckResponse.builder()
                    .hasConflict(false)
                    .message("Không có xung đột lịch.")
                    .build();
        }

        Session firstConflict = conflicts.get(0);
        String cause = buildConflictDescription(request, firstConflict);

        return ConflictCheckResponse.builder()
                .hasConflict(true)
                .message(cause)
                .conflictingSessions(conflicts.stream().map(sessionMapper::toResponse).toList())
                .build();
    }

    private String buildConflictDescription(SessionDTO request, Session conflict) {
        String timeRange = conflict.getStartTime().format(TIME_FORMATTER) + " -> " + conflict.getEndTime().format(TIME_FORMATTER);

        if (conflict.getTrainerId().equals(request.getTrainerId())) {
            return String.format(
                    "Xung đột lịch Giảng viên: [%s] đã có lịch dạy lớp [%s] ('%s') trong khoảng thời gian %s.",
                    conflict.getTrainerName(),
                    conflict.getClassCode(),
                    conflict.getTitle(),
                    timeRange
            );
        }

        if (request.getRoom() != null && !request.getRoom().isBlank() && request.getRoom().equalsIgnoreCase(conflict.getRoom())) {
            return String.format(
                    "Xung đột Phòng học: [%s] đã được đặt cho lớp [%s] ('%s') trong khoảng thời gian %s.",
                    conflict.getRoom(),
                    conflict.getClassCode(),
                    conflict.getTitle(),
                    timeRange
            );
        }

        return String.format(
                "Xung đột Link họp trực tuyến: [%s] đang bận cho buổi '%s' (%s).",
                conflict.getMeetingLink(),
                conflict.getTitle(),
                timeRange
        );
    }

    /**
     * F15 — Hủy buổi học (shortcut {@code POST /api/v1/sessions/{id}/cancel}).
     *
     * <p>Quy tắc áp dụng:</p>
     * <ul>
     *     <li>Bắt buộc có {@code cancelReason} (≤ 500 ký tự) → 422 VALIDATION_FAILED (BR-SES-03).</li>
     *     <li>Buổi học phải tồn tại → 404 SESSION_NOT_FOUND.</li>
     *     <li>Phiên bản phải khớp (nếu client gửi If-Match/version) → 409 SESSION_VERSION_CONFLICT.</li>
     *     <li>Chỉ chuyển được từ SCHEDULED → CANCELLED (một chiều) → 409 SESSION_INVALID_TRANSITION.</li>
     * </ul>
     */
    @Override
    public SessionDTO cancel(Long id, SessionCancelRequest request, Long expectedVersion) {

        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session", "id", id));

        // 1. Validate cancelReason (BR-SES-03) -> 422 VALIDATION_FAILED
        String reason = request != null ? request.getCancelReason() : null;
        if (reason == null || reason.isBlank()) {
            throw UnprocessableEntityException.of(
                    "VALIDATION_FAILED",
                    "cancelReason",
                    "Lý do hủy là bắt buộc khi hủy buổi học (BR-SES-03).");
        }
        reason = reason.trim();
        if (reason.length() > MAX_CANCEL_REASON_LENGTH) {
            throw UnprocessableEntityException.of(
                    "VALIDATION_FAILED",
                    "cancelReason",
                    "Lý do hủy không được vượt quá " + MAX_CANCEL_REASON_LENGTH + " ký tự.");
        }

        // 2. Kiểm tra phiên bản (optimistic locking) -> 409 SESSION_VERSION_CONFLICT
        if (expectedVersion != null && !expectedVersion.equals(session.getVersion())) {
            throw new ConflictException(
                    "SESSION_VERSION_CONFLICT",
                    "Phiên bản buổi học đã thay đổi, vui lòng tải lại (currentVersion=" + session.getVersion() + ").");
        }

        // 3. Chỉ hủy được buổi đang SCHEDULED -> 409 SESSION_INVALID_TRANSITION
        if (session.getStatus() != SessionStatus.SCHEDULED) {
            throw new ConflictException(
                    "SESSION_INVALID_TRANSITION",
                    "Chỉ có thể hủy buổi học ở trạng thái SCHEDULED. Trạng thái hiện tại: " + session.getStatus() + ".");
        }

        // 4. Áp dụng chuyển trạng thái một chiều SCHEDULED -> CANCELLED
        session.setStatus(SessionStatus.CANCELLED);
        session.setCancelReason(reason);
        if (request.getNotes() != null) {
            session.setNotes(request.getNotes());
        }

        // updatedAt/updatedBy được cập nhật tự động bởi JPA auditing.
        Session saved = sessionRepository.save(session);
        return sessionMapper.toResponse(saved);
    }
}
