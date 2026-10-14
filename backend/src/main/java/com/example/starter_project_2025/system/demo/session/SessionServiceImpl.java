package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.*;
import com.example.starter_project_2025.system.demo.calendar.*;
import com.example.starter_project_2025.system.demo.calendar_version.CalendarVersion;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Service
@Transactional
@RequiredArgsConstructor
public class SessionServiceImpl extends BaseCrudServiceImpl<Session, Long, SessionDTO, SessionFilter>
        implements SessionService {
    private final SessionMapper sessionMapper;
    private final SessionRepository sessionRepository;
    private final CalendarLock locks;
    private final CalendarRules rules;
    private final EntityManager entityManager;

    @Override protected BaseCrudRepository<Session, Long> getRepository() { return sessionRepository; }
    @Override protected BaseCrudMapper<Session, SessionDTO> getMapper() { return sessionMapper; }
    @Override protected String[] searchableFields() { return new String[]{"title", "location"}; }

    @Override
    protected void beforeCreate(Session session, SessionDTO request, ValidationContext ctx) {
        CalendarVersion version = locks.version(request.getCalendarVersionId());
        rules.requireDraft(version);
        session.setClassId(version.getCalendar().getClassId());
        session.setStatus(Session.SessionStatus.SCHEDULED);
        validateTime(version.getCalendar(), session.getStartTime(), session.getEndTime(), ctx);
    }

    @Override
    public SessionDTO update(Long id, SessionDTO request) {
        checkPermission(CrudAction.UPDATE);
        rules.requireDraft(locks.session(id));
        refreshSession(id);
        return super.update(id, request);
    }

    @Override
    protected void beforeUpdate(Session session, SessionDTO request, ValidationContext ctx) {
        if (request.getCalendarVersionId() != null
                && !request.getCalendarVersionId().equals(session.getCalendarVersionId())) {
            ctx.add("calendarVersionId", "A session cannot be moved to another version");
        }
        if (session.getStatus() != Session.SessionStatus.SCHEDULED) {
            throw new ConflictException("Cannot update a completed or cancelled session");
        }
        LocalDateTime start = request.getStartTime() != null ? request.getStartTime() : session.getStartTime();
        LocalDateTime end = request.getEndTime() != null ? request.getEndTime() : session.getEndTime();
        validateTime(session.getCalendarVersion().getCalendar(), start, end, ctx);
    }

    @Override
    public void delete(Long id) {
        checkPermission(CrudAction.DELETE);
        rules.requireDraft(locks.session(id));
        Session session = refreshSession(id);
        if (session.getStatus() != Session.SessionStatus.SCHEDULED) {
            throw new ConflictException("Cannot delete a completed or cancelled session");
        }
        super.delete(id);
    }

    @Override
    public SessionDTO cancelSession(Long id, SessionCancelDTO request) {
        checkPermission(CrudAction.UPDATE);
        CalendarVersion version = locks.session(id);
        if (version.getPublishedAt() != null && version.getStatus() != CalendarVersion.Status.ACTIVE) {
            throw new ConflictException("Cannot cancel a session in an inactive published version");
        }
        Session session = refreshSession(id);
        if (session.getStatus() != Session.SessionStatus.SCHEDULED) {
            throw new ConflictException("Only scheduled sessions can be cancelled");
        }
        if (request.getCancelReason() == null || request.getCancelReason().isBlank()
                || request.getCancelReason().length() > 255) {
            throw new BadRequestException("Cancel reason is required and must not exceed 255 characters");
        }
        session.setStatus(Session.SessionStatus.CANCELLED);
        session.setCancelReason(request.getCancelReason());
        return sessionMapper.toResponse(session);
    }

    private Session refreshSession(Long id) {
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found: " + id));
        entityManager.refresh(session);
        return session;
    }

    private void validateTime(TrainingCalendar calendar, LocalDateTime start, LocalDateTime end, ValidationContext ctx) {
        rules.session(start, end, calendar.getClassStartDate(), calendar.getClassEndDate(), "", ctx);
    }
}
