package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.dto.SessionCancelRequest;
import com.example.starter_project_2025.system.schedule.exception.ConflictException;
import com.example.starter_project_2025.system.schedule.exception.UnprocessableEntityException;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.system.schedule.session.dto.SessionResponse;
import com.example.starter_project_2025.system.schedule.session.dto.CreateSessionRequest;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SessionServiceImpl implements SessionService {

    private static final int MAX_CANCEL_REASON_LENGTH = 500;

    private final SessionRepository sessionRepository;
    private final SessionMapper sessionMapper;
    private final SessionAccessPolicy accessPolicy;
    private final ObjectProvider<SessionCreateContextProvider> createContextProviders;
    private final ObjectProvider<SessionCreateConflictChecker> createConflictCheckers;
    private final Validator validator;

    @Override
    public SessionResponse getById(Long sessionId) {
        Authentication actor = accessPolicy.requireReadPermission();
        if (sessionId == null || sessionId <= 0) {
            throw new BadRequestException("Session ID must be a positive number.");
        }

        Session session = sessionRepository.findByIdAndIsActiveTrue(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found."));
        SessionReadContextProvider.ReadContext context = accessPolicy.requireReadableContext(session, actor);
        return sessionMapper.toResponse(session, context);
    }

    @Override
    @Transactional
    public SessionResponse create(Long calendarVersionId, CreateSessionRequest request) {
        Authentication actor = accessPolicy.requireCreatePermission();
        if (calendarVersionId == null || calendarVersionId <= 0 || request == null) {
            throw new SessionRequestException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                    "A positive calendar version ID and a request body are required.");
        }
        Map<String, List<String>> errors = new LinkedHashMap<>();
        validator.validate(request).forEach(violation -> errors
                .computeIfAbsent(violation.getPropertyPath().toString(), key -> new ArrayList<>())
                .add(violation.getMessage()));
        if (!errors.isEmpty()) {
            throw new SessionRequestException(HttpStatus.UNPROCESSABLE_ENTITY, "SESSION_VALIDATION_FAILED",
                    "Session data is invalid.", errors);
        }

        SessionCreateContextProvider provider = createContextProviders.getIfAvailable();
        if (provider == null) {
            throw contextUnavailable();
        }
        SessionCreateContextProvider.CalendarVersionContext version = provider
                .lockCalendarVersion(calendarVersionId, actor)
                .orElseThrow(() -> new SessionRequestException(HttpStatus.NOT_FOUND,
                        "CALENDAR_VERSION_NOT_FOUND", "Calendar version not found."));
        if (!version.canCreate()) {
            throw new AccessDeniedException("Calendar version is outside your permitted creation scope.");
        }
        if (version.status() == null) {
            throw contextUnavailable();
        }
        if (!"DRAFT".equals(version.status())) {
            throw new SessionRequestException(HttpStatus.CONFLICT, "CALENDAR_VERSION_NOT_EDITABLE",
                    "Sessions can only be created in a DRAFT calendar version.");
        }
        if (version.classId() == null || version.programId() == null || version.versionNumber() == null
                || version.classStartDate() == null || version.classEndDate() == null
                || version.holidays() == null || version.classEndDate().isBefore(version.classStartDate())) {
            throw contextUnavailable();
        }
        if (!request.getEndTime().isAfter(request.getStartTime())) {
            throw SessionRequestException.validation("endTime", "End time must be after start time.");
        }
        if (request.getStartTime().toLocalDate().isBefore(version.classStartDate())
                || request.getStartTime().toLocalDate().isAfter(version.classEndDate())) {
            throw SessionRequestException.validation("startTime", "Start time must be within the class date range.");
        }
        if (request.getEndTime().toLocalDate().isBefore(version.classStartDate())
                || request.getEndTime().toLocalDate().isAfter(version.classEndDate())) {
            throw SessionRequestException.validation("endTime", "End time must be within the class date range.");
        }
        if (version.holidays().stream().anyMatch(day -> !day.isBefore(request.getStartTime().toLocalDate())
                && day.atStartOfDay().isBefore(request.getEndTime()))) {
            throw SessionRequestException.validation("startTime", "Session cannot take place on a holiday.");
        }

        SessionCreateContextProvider.TopicContext topic = provider.findTopic(request.getTopicId(), actor)
                .orElseThrow(() -> SessionRequestException.validation("topicId", "Topic does not exist."));
        if (!version.programId().equals(topic.programId())) {
            throw SessionRequestException.validation("topicId", "Topic must belong to the class program.");
        }
        SessionCreateContextProvider.TrainerContext trainer = provider.findTrainer(
                        request.getTrainerId(), version.classId(), request.getTopicId(), actor)
                .orElseThrow(() -> SessionRequestException.validation("trainerId", "Trainer is not valid."));
        if (!trainer.assigned()) {
            throw SessionRequestException.validation("trainerId", "Trainer is not assigned to this class/topic.");
        }

        SessionCreateConflictChecker checker = createConflictCheckers.getIfAvailable();
        if (checker == null) {
            throw conflictCheckUnavailable();
        }
        var result = checker.checkCandidate(calendarVersionId, request);
        if (result == null || !calendarVersionId.equals(result.getCalendarVersionId())
                || result.getValidationErrors() == null || result.getConflicts() == null) {
            throw conflictCheckUnavailable();
        }
        if (!result.getValidationErrors().isEmpty()) {
            throw new SessionRequestException(HttpStatus.UNPROCESSABLE_ENTITY, "SESSION_VALIDATION_FAILED",
                    "Session data is invalid.", result.getValidationErrors());
        }
        if (result.isHasConflict() || !result.getConflicts().isEmpty()) {
            throw new SessionRequestException(HttpStatus.CONFLICT, "SESSION_CONFLICT",
                    "Session conflicts with the existing schedule.");
        }

        Session session = Session.builder().calendarVersionId(calendarVersionId).topicId(request.getTopicId())
                .trainerId(request.getTrainerId()).title(request.getTitle().trim())
                .startTime(request.getStartTime()).endTime(request.getEndTime())
                .room(request.getRoom()).meetingLink(request.getMeetingLink())
                .status(SessionStatus.SCHEDULED).build();
        Session saved = sessionRepository.saveAndFlush(session);
        var context = new SessionReadContextProvider.ReadContext(version.versionNumber(), version.status(),
                version.classId(), version.classCode(), topic.name(), trainer.fullName());
        return sessionMapper.toResponse(saved, context);
    }

    private SessionRequestException contextUnavailable() {
        return new SessionRequestException(HttpStatus.SERVICE_UNAVAILABLE, "SESSION_CONTEXT_UNAVAILABLE",
                "Calendar version, class, topic and trainer integration is not available.");
    }

    private SessionRequestException conflictCheckUnavailable() {
        return new SessionRequestException(HttpStatus.SERVICE_UNAVAILABLE, "SESSION_CONFLICT_CHECK_UNAVAILABLE",
                "Candidate session conflict checking is not available.");
    }

    @Override
    @Transactional
    @PreAuthorize("hasAuthority('SESSION_UPDATE')")
    public SessionDTO cancel(Long sessionId, SessionCancelRequest request, Long expectedVersion) {
        if (sessionId == null || sessionId <= 0) {
            throw new BadRequestException("Session ID must be a positive number.");
        }
        Session session = sessionRepository.findByIdAndIsActiveTrue(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session", "id", sessionId));

        String reason = request != null ? request.getCancelReason() : null;
        if (reason == null || reason.isBlank()) {
            throw UnprocessableEntityException.of("VALIDATION_FAILED", "cancelReason",
                    "Lý do hủy là bắt buộc khi hủy buổi học (BR-SES-03).");
        }
        reason = reason.trim();
        if (reason.length() > MAX_CANCEL_REASON_LENGTH) {
            throw UnprocessableEntityException.of("VALIDATION_FAILED", "cancelReason",
                    "Lý do hủy không được vượt quá " + MAX_CANCEL_REASON_LENGTH + " ký tự.");
        }

        if (expectedVersion != null && !expectedVersion.equals(session.getVersion())) {
            throw new ConflictException("SESSION_VERSION_CONFLICT",
                    "Phiên bản buổi học đã thay đổi, vui lòng tải lại (currentVersion="
                            + session.getVersion() + ").");
        }
        if (session.getStatus() != SessionStatus.SCHEDULED) {
            throw new ConflictException("SESSION_INVALID_TRANSITION",
                    "Chỉ có thể hủy buổi học ở trạng thái SCHEDULED. Trạng thái hiện tại: "
                            + session.getStatus() + ".");
        }

        session.setStatus(SessionStatus.CANCELLED);
        session.setCancelReason(reason);
        if (request.getNotes() != null) {
            session.setNotes(request.getNotes());
        }
        Session saved = sessionRepository.saveAndFlush(session);
        return sessionMapper.toStatusResponse(saved);
    }
}
