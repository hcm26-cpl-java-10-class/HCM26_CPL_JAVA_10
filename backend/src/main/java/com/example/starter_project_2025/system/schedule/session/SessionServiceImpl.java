package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.session.dto.ConflictCheckResponse;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.system.schedule.session.dto.SessionCancelRequest;
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
    SessionValidator sessionValidator;
    SessionAccessPolicy sessionAccessPolicy;

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
        sessionAccessPolicy.requireCreateScope();
        sessionValidator.validateCreateRequest(request, ctx);
        entity.setCalendarVersion(sessionValidator.requireDraftVersion(request.getCalendarVersionId(), ctx));
        entity.setStatus(SessionStatus.SCHEDULED);
        entity.setNotes(null);
        entity.setCancelReason(null);
        entity.setIsActive(true);
        sessionValidator.validateReferences(entity, request, ctx);
        ctx.throwIfErrors();
        validateSession(entity, request, ctx, null);
        ctx.throwIfErrors();
        sessionValidator.validateClassDates(entity, ctx);
    }

    @Override
    public SessionDTO update(Long id, SessionDTO request) {
        checkPermission(CrudAction.UPDATE);
        sessionAccessPolicy.requireCreateScope();
        if (id == null || id <= 0) {
            throw new BadRequestException("Session ID must be positive.");
        }
        Session entity = sessionRepository.findByIdAndIsActiveTrue(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found."));
        ValidationContext ctx = new ValidationContext();
        Long versionId = entity.getCalendarVersion().getId();
        sessionValidator.requireDraftVersion(versionId, ctx);
        sessionValidator.validateUpdateRequest(request, ctx);
        if (request.getCalendarVersionId() != null && !versionId.equals(request.getCalendarVersionId())) {
            ctx.add("calendarVersionId", "Session cannot be moved to another calendar version.");
        }
        ctx.throwIfErrors();

        Session updated = sessionMapper.toEntity(request);
        updated.setCalendarVersion(entity.getCalendarVersion());
        updated.setIsOverridden(entity.getIsOverridden());
        updated.setOverrideReason(entity.getOverrideReason());
        sessionValidator.validateReferences(updated, request, ctx);
        ctx.throwIfErrors();
        validateSession(updated, request, ctx, id);
        ctx.throwIfErrors();
        sessionValidator.validateClassDates(updated, ctx);
        ctx.throwIfErrors();

        sessionMapper.update(entity, request);
        entity.setClassCode(updated.getClassCode());
        entity.setTopicName(updated.getTopicName());
        entity.setTrainerName(updated.getTrainerName());
        entity.setIsOverridden(updated.getIsOverridden());
        entity.setOverrideReason(updated.getOverrideReason());
        return sessionMapper.toResponse(sessionRepository.saveAndFlush(entity));
    }

    @Override
    public void delete(Long id) {
        checkPermission(CrudAction.DELETE);
        sessionAccessPolicy.requireCreateScope();
        if (id == null || id <= 0) {
            throw new BadRequestException("Session ID must be positive.");
        }
        Session entity = sessionRepository.findByIdAndIsActiveTrue(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found."));
        sessionValidator.requireDraftVersion(entity.getCalendarVersion().getId(), new ValidationContext());
        sessionRepository.delete(entity);
        sessionRepository.flush();
    }

    @Override
    @Transactional(readOnly = true)
    public SessionDTO getById(Long id) {
        checkPermission(CrudAction.READ);
        if (id == null || id <= 0) {
            throw new BadRequestException("Session ID must be positive.");
        }
        Session session = sessionRepository.findByIdAndIsActiveTrue(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found."));
        sessionAccessPolicy.requireReadScope(session);
        return sessionMapper.toResponse(session);
    }

    private void validateSession(Session entity, SessionDTO request, ValidationContext ctx, Long excludeId) {
        if (request.getStartTime() == null || request.getEndTime() == null) {
            ctx.add("time", "Thời gian bắt đầu và kết thúc không được để trống.");
            return;
        }

        if (!request.getEndTime().isAfter(request.getStartTime())) {
            ctx.add("endTime", "Thời gian kết thúc phải diễn ra sau thời gian bắt đầu.");
            return;
        }
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
                if (request.getOverrideReason() == null || request.getOverrideReason().trim().isEmpty()) {
                    ctx.add("overrideReason", "Bắt buộc phải nhập lý do khi override lịch trùng.");
                } else {
                    String reason = request.getOverrideReason().trim();
                    entity.setIsOverridden(true);
                    entity.setOverrideReason(reason);
                    request.setIsOverridden(true);
                    request.setOverrideReason(reason);
                }
            } else {
                Session firstConflict = conflicts.get(0);
                String conflictCause = buildConflictDescription(request, firstConflict);
                ctx.add("conflict", conflictCause);
            }
        } else {
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

    @Override
    public SessionDTO changeStatus(Long id, SessionStatus status) {

        checkPermission(CrudAction.UPDATE);

        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found: " + id));

        session.setStatus(status);

        Session saved = sessionRepository.save(session);
        return sessionMapper.toResponse(saved);
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

    @Override
    public SessionDTO cancel(Long id, SessionCancelRequest request, Long expectedVersion) {

        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session", "id", id));
        String reason = request != null ? request.getCancelReason() : null;
        if (reason == null || reason.isBlank()) {
            throw UnprocessableEntityException.of(
                    "VALIDATION_FAILED",
                    "cancelReason",
                    "Lý do hủy là bắt buộc khi hủy buổi học.");
        }
        reason = reason.trim();
        if (reason.length() > MAX_CANCEL_REASON_LENGTH) {
            throw UnprocessableEntityException.of(
                    "VALIDATION_FAILED",
                    "cancelReason",
                    "Lý do hủy không được vượt quá " + MAX_CANCEL_REASON_LENGTH + " ký tự.");
        }
        if (expectedVersion != null && !expectedVersion.equals(session.getVersion())) {
            throw new ConflictException(
                    "SESSION_VERSION_CONFLICT",
                    "Phiên bản buổi học đã thay đổi, vui lòng tải lại (currentVersion=" + session.getVersion() + ").");
        }
        if (session.getStatus() != SessionStatus.SCHEDULED) {
            throw new ConflictException(
                    "SESSION_INVALID_TRANSITION",
                    "Chỉ có thể hủy buổi học ở trạng thái SCHEDULED. Trạng thái hiện tại: " + session.getStatus() + ".");
        }
        session.setStatus(SessionStatus.CANCELLED);
        session.setCancelReason(reason);
        if (request.getNotes() != null) {
            session.setNotes(request.getNotes());
        }
        Session saved = sessionRepository.save(session);
        return sessionMapper.toResponse(saved);
    }
}
