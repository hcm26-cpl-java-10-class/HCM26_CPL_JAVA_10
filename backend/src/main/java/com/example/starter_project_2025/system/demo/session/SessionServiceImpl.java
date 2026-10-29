package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.session.SessionService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import com.example.starter_project_2025.system.schedule.*;
import com.example.starter_project_2025.base.crud.CrudAction;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionServiceImpl
        extends BaseCrudServiceImpl<Session, Long, SessionDTO, SessionFilter>
        implements SessionService {

    SessionMapper sessionMapper;
    SessionRepository sessionRepository;
    ScheduleValidationEngine conflicts;
    com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentSessionGuard assignmentGuard;

    @Override
    public SessionDTO create(SessionDTO request) {
        checkPermission(CrudAction.CREATE);
        checkPermission(CrudAction.READ);
        conflicts.lockForWrite();
        request.setId(null);
        return super.create(request);
    }

    @Override
    public SessionDTO update(Long id, SessionDTO request) {
        checkPermission(CrudAction.UPDATE);
        checkPermission(CrudAction.READ);
        conflicts.lockForWrite();
        request.setId(id);
        return super.update(id, request);
    }

    @Override
    public List<SessionDTO> createValidatedBatch(List<SessionDTO> requests) {
        checkPermission(CrudAction.CREATE);
        checkPermission(CrudAction.READ);
        conflicts.lockForWrite();
        conflicts.requireValid(requests.stream().map(r -> candidate(null, r)).toList());
        return requests.stream().map(this::create).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ScheduleValidationResult previewValidatedBatch(List<SessionDTO> requests) {
        checkPermission(CrudAction.CREATE);
        checkPermission(CrudAction.READ);
        var candidates = requests.stream().map(request -> candidate(null, request)).toList();
        var validation = conflicts.validate(candidates);
        var issues = new java.util.ArrayList<>(validation.issues());
        for (int index = 0; index < candidates.size(); index++) {
            try {
                assignmentGuard.checkCompatible(candidates.get(index));
            } catch (com.example.starter_project_2025.exception.BusinessValidationException error) {
                int rowIndex = index;
                error.getErrors().forEach((field, messages) -> messages.forEach(message ->
                        issues.add(new ScheduleIssue("ASSIGNMENT_INVALID", field, message, rowIndex,
                                null, null, null, null, null))));
            }
        }
        return new ScheduleValidationResult(issues.isEmpty(), validation.timezone(), List.copyOf(issues));
    }

    @Override
    public void delete(Long id) {
        checkPermission(CrudAction.DELETE);
        conflicts.lockForWrite();
        sessionRepository.findById(id).ifPresent(session -> assignmentGuard.rememberUse(session.getTeachingAssignmentId()));
        super.delete(id);
    }

    private ScheduleCandidate candidate(Session current, SessionDTO r) {
        return new ScheduleCandidate(current == null ? null : current.getId(),
                r.getClassId() != null ? r.getClassId() : current == null ? null : current.getClassId(),
                r.getTopicId() != null ? r.getTopicId() : current == null ? null : current.getTopicId(),
                r.getTrainerId() != null ? r.getTrainerId() : current == null ? null : current.getTrainerId(),
                r.getTeachingAssignmentId() != null ? r.getTeachingAssignmentId() : current == null ? null : current.getTeachingAssignmentId(),
                r.getRoomId() != null ? r.getRoomId() : r.getLocation() != null && r.getLocation().isBlank() ? null : current == null ? null : current.getRoomId(),
                r.getLocation() != null ? r.getLocation() : current == null ? null : current.getLocation(),
                r.getMeetingUrl() != null ? r.getMeetingUrl() : current == null ? null : current.getMeetingUrl(),
                r.getTitle() != null ? r.getTitle() : current == null ? null : current.getTitle(),
                r.getStartTime() != null ? r.getStartTime() : current == null ? null : current.getStartTime(),
                r.getEndTime() != null ? r.getEndTime() : current == null ? null : current.getEndTime());
    }

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
        // Cho phép tìm kiếm nhanh theo tiêu đề hoặc phòng học
        return new String[]{"title", "location"};
    }

    @Override
    protected void beforeCreate(Session session, SessionDTO request, ValidationContext ctx) {
        assignmentGuard.requireCompatible(candidate(null, request));
        conflicts.requireValid(List.of(candidate(null, request)));
        // 1. Kiểm tra thời gian: end_time phải sau start_time (BR-02, FR-CAL-01)
        validateSessionTime(request.getStartTime(), request.getEndTime(), ctx);

        // 2. Mặc định trạng thái khi tạo mới là SCHEDULED
        session.setStatus(Session.SessionStatus.SCHEDULED);
    }

    @Override
    protected void beforeUpdate(Session session, SessionDTO request, ValidationContext ctx) {
        // Không cho phép sửa nếu buổi học đã hoàn thành hoặc đã bị hủy
        if (session.getStatus() == Session.SessionStatus.COMPLETED) {
            ctx.add("status", "Completed sessions cannot be edited.");
            return;
        }

        if (session.getStatus() == Session.SessionStatus.CANCELLED) {
            ctx.add("status", "Cancelled sessions cannot be edited.");
            return;
        }

        // Lấy thời gian mới (nếu request truyền lên) hoặc giữ nguyên thời gian cũ
        LocalDateTime newStart = request.getStartTime() != null ? request.getStartTime() : session.getStartTime();
        LocalDateTime newEnd = request.getEndTime() != null ? request.getEndTime() : session.getEndTime();

        validateSessionTime(newStart, newEnd, ctx);
        assignmentGuard.rememberUse(session.getTeachingAssignmentId());
        assignmentGuard.requireCompatible(candidate(session, request));
        conflicts.requireValid(List.of(candidate(session, request)));
        // An explicit empty location clears a previously selected physical room.
        if (request.getRoomId() == null && request.getLocation() != null && request.getLocation().isBlank()) {
            session.setRoomId(null);
        }
    }

    @Override
    public SessionDTO cancelSession(Long id, SessionCancelDTO cancelDTO) {
        checkPermission(CrudAction.UPDATE);
        checkPermission(CrudAction.READ);
        conflicts.lockForWrite();
        // Lấy session từ DB
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found. Session ID: " + id));

        // Kiểm tra điều kiện nghiệp vụ: Không hủy buổi học đã hoàn thành
        if (session.getStatus() == Session.SessionStatus.COMPLETED) {
            throw new IllegalStateException("Completed sessions cannot be cancelled.");
        }

        if (session.getStatus() == Session.SessionStatus.CANCELLED) {
            throw new IllegalStateException("This session has already been cancelled.");
        }

        // Cập nhật trạng thái và lý do hủy (Soft cancel theo BR-03)
        session.setStatus(Session.SessionStatus.CANCELLED);
        session.setCancelReason(cancelDTO.getCancelReason());

        Session updatedSession = sessionRepository.save(session);
        return sessionMapper.toDto(updatedSession);
    }

    @Override
    public SessionDTO completeSession(Long id, SessionCompleteDTO completeDTO) {
        checkPermission(CrudAction.UPDATE);
        // Serialize with cancel/edit/import before reading the current status.
        conflicts.lockForWrite();
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found. Session ID: " + id));

        if (session.getStatus() != Session.SessionStatus.SCHEDULED) {
            throw new ConflictException("Only scheduled sessions can be completed.");
        }

        if (completeDTO != null && completeDTO.getNote() != null) {
            session.setNote(completeDTO.getNote());
        }
        session.setStatus(Session.SessionStatus.COMPLETED);
        return sessionMapper.toDto(sessionRepository.save(session));
    }

    /**
     * Validate nghiệp vụ thời gian: End Time phải lớn hơn Start Time
     */
    private void validateSessionTime(LocalDateTime start, LocalDateTime end, ValidationContext ctx) {
        if (start != null && end != null && !end.isAfter(start)) {
            ctx.add("endTime", "The end time must be later than the start time.");
        }
    }
}
