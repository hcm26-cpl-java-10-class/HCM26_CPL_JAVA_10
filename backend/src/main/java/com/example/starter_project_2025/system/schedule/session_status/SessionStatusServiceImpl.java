package com.example.starter_project_2025.system.schedule.session_status;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.Session;
import com.example.starter_project_2025.system.schedule.SessionDTO;
import com.example.starter_project_2025.system.schedule.SessionMapper;
import com.example.starter_project_2025.system.schedule.SessionRepository;
import com.example.starter_project_2025.system.schedule.SessionStatus;
import com.example.starter_project_2025.system.schedule.dto.SessionCancelRequest;
import com.example.starter_project_2025.system.schedule.exception.ConflictException;
import com.example.starter_project_2025.system.schedule.exception.UnprocessableEntityException;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionStatusServiceImpl implements SessionStatusService {

    static final int MAX_CANCEL_REASON_LENGTH = 500;

    SessionRepository sessionRepository;
    SessionMapper sessionMapper;

    @Override
    @PreAuthorize("hasAuthority('SESSION_UPDATE')")
    public SessionDTO changeStatus(Long id, SessionStatus status) {

        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found: " + id));

        session.setStatus(status);

        Session saved = sessionRepository.save(session);
        return sessionMapper.toResponse(saved);
    }

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

        // 2. Optimistic locking -> 409 SESSION_VERSION_CONFLICT
        if (expectedVersion != null && !expectedVersion.equals(session.getVersion())) {
            throw new ConflictException(
                    "SESSION_VERSION_CONFLICT",
                    "Phiên bản buổi học đã thay đổi, vui lòng tải lại (currentVersion=" + session.getVersion() + ").");
        }

        // 3. One-way SCHEDULED -> CANCELLED -> 409 SESSION_INVALID_TRANSITION
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