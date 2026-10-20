package com.example.starter_project_2025.system.schedule.calendar.crud;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.schedule.session.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class CalendarVersionCrudServiceImpl
        extends BaseCrudServiceImpl<CalendarVersion, Long, CalendarVersionDTO, CalendarVersionCrudFilter>
        implements CalendarVersionCrudService {
    private final CalendarVersionRepository versions;
    private final CalendarVersionCrudMapper mapper;
    private final SessionRepository sessions;
    private final CalendarLock locks;
    private final CalendarRules rules;

    @Override protected BaseCrudRepository<CalendarVersion, Long> getRepository() { return versions; }
    @Override protected BaseCrudMapper<CalendarVersion, CalendarVersionDTO> getMapper() { return mapper; }
    @Override protected String[] searchableFields() { return new String[]{"name", "description"}; }

    @Override
    protected void beforeCreate(CalendarVersion entity, CalendarVersionDTO request, ValidationContext ctx) {
        Calendar calendar = locks.calendar(request.getCalendarId());
        allocateVersion(entity, calendar);
    }

    private void allocateVersion(CalendarVersion version, Calendar calendar) {
        version.setCalendarId(calendar.getId());
        version.setCalendar(calendar);
        version.setVersionNumber(calendar.getNextVersionNumber());
        calendar.setNextVersionNumber(Math.addExact(calendar.getNextVersionNumber(), 1));
        version.setStatus(CalendarVersionStatus.DRAFT);
    }

    @Override
    public CalendarVersionDTO update(Long id, CalendarVersionDTO request) {
        checkPermission(CrudAction.UPDATE);
        rules.requireDraft(locks.version(id));
        return super.update(id, request);
    }

    @Override
    protected void beforeUpdate(CalendarVersion entity, CalendarVersionDTO request, ValidationContext ctx) {
        if (request.getCalendarId() != null && !request.getCalendarId().equals(entity.getCalendarId())) {
            ctx.add("calendarId", "A version cannot be moved to another calendar");
        }
    }

    @Override
    public void delete(Long id) {
        checkPermission(CrudAction.DELETE);
        CalendarVersion version = locks.version(id);
        rules.requireDraft(version);
        // Flush children first so FK ordering is explicit.
        sessions.deleteAll(sessions.findByCalendarVersionIdOrderByStartTimeAscIdAsc(id));
        sessions.flush();
        super.delete(id);
    }

    @Override
    public CalendarVersionDTO activate(Long id) {
        check("CALENDAR_VERSION_ACTIVATE");
        CalendarVersion version = locks.version(id);
        Calendar calendar = version.getCalendar();
        if (version.getStatus() == CalendarVersionStatus.ACTIVE) return mapper.toResponse(version);
        List<Session> entries = sessions.findByCalendarVersionIdOrderByStartTimeAscIdAsc(id).stream()
                .filter(session -> Boolean.TRUE.equals(session.getIsActive())).toList();
        if (entries.isEmpty()) throw new BadRequestException("Cannot activate an empty calendar version");
        validateSessions(calendar, entries);
        if (version.getPublishedAt() == null) {
            version.setPublishedAt(LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")));
        }
        versions.findActiveVersionByCalendarId(calendar.getId(), CalendarVersionStatus.ACTIVE)
                .filter(previous -> !previous.getId().equals(id))
                .ifPresent(previous -> previous.setStatus(CalendarVersionStatus.INACTIVE));
        version.setStatus(CalendarVersionStatus.ACTIVE);
        version.setActivatedAt(version.getPublishedAt());
        calendar.setActiveVersionId(id);
        // Both statuses and the calendar pointer commit under the same calendar lock.
        return mapper.toResponse(version);
    }

    @Override
    public CalendarVersionDTO cloneVersion(Long id) {
        checkPermission(CrudAction.CREATE);
        checkPermission(CrudAction.READ);
        check("SESSION_READ");
        check("SESSION_CREATE");
        CalendarVersion source = locks.version(id);
        List<Session> originals = sessions.findByCalendarVersionIdOrderByStartTimeAscIdAsc(id).stream()
                .filter(session -> Boolean.TRUE.equals(session.getIsActive())).toList();
        validateSessions(source.getCalendar(), originals);
        CalendarVersion copy = new CalendarVersion();
        copy.setName(source.getName());
        copy.setDescription(source.getDescription());
        allocateVersion(copy, source.getCalendar());
        versions.saveAndFlush(copy);
        for (Session original : originals) {
            Session session = new Session();
            session.setCalendarVersion(copy);
            session.setClassCode(original.getClassCode());
            session.setTopicName(original.getTopicName());
            session.setTrainerName(original.getTrainerName());
            session.setMeetingLink(original.getMeetingLink());
            session.setIsOverridden(original.getIsOverridden());
            session.setOverrideReason(original.getOverrideReason());
            session.setTopicId(original.getTopicId());
            session.setTrainerId(original.getTrainerId());
            session.setTitle(original.getTitle());
            session.setStartTime(original.getStartTime());
            session.setEndTime(original.getEndTime());
            session.setRoom(original.getRoom());
            session.setStatus(original.getStatus());
            session.setNotes(original.getNotes());
            session.setCancelReason(original.getCancelReason());
            sessions.save(session);
        }
        return mapper.toResponse(copy);
    }

    private void validateSessions(Calendar calendar, List<Session> entries) {
        ValidationContext ctx = new ValidationContext();
        for (Session session : entries) {
            String prefix = "sessions[" + session.getId() + "].";
            if (!calendar.getClassId().equals(session.getClassId())) {
                ctx.add(prefix + "classId", "Session must belong to the calendar's class");
            }
            rules.sessionForCalendar(calendar, session.getStartTime(), session.getEndTime(), prefix, ctx);
        }
        ctx.throwIfErrors();
    }
}
