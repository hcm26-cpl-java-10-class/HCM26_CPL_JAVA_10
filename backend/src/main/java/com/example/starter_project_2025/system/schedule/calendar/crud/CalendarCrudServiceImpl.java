package com.example.starter_project_2025.system.schedule.calendar.crud;

import java.util.Objects;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.*;

import com.example.starter_project_2025.system.schedule.session.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class CalendarCrudServiceImpl extends BaseCrudServiceImpl<Calendar, Long, CalendarDTO, CalendarFilter>
        implements CalendarCrudService {
    private final CalendarRepository calendars;
    private final CalendarVersionRepository versions;
    private final CalendarCrudMapper mapper;
    private final SessionRepository sessions;
    private final SessionMapper sessionMapper;
    private final CalendarRules rules;
    private final CalendarLock locks;

    @Override protected BaseCrudRepository<Calendar, Long> getRepository() { return calendars; }
    @Override protected BaseCrudMapper<Calendar, CalendarDTO> getMapper() { return mapper; }
    @Override protected String[] searchableFields() { return new String[]{"name", "description"}; }

    @Override
    protected void beforeCreate(Calendar entity, CalendarDTO request, ValidationContext ctx) {
        if (request.getClassId() == null || request.getClassId() <= 0) ctx.add("classId", "A positive class ID is required");
        if (calendars.existsByClassId(request.getClassId())) {
            throw new ConflictException("This class already has a calendar");
        }
        rules.dates(entity.getClassStartDate(), entity.getClassEndDate(), ctx);
    }

    @Override
    public CalendarDTO update(Long id, CalendarDTO request) {
        checkPermission(CrudAction.UPDATE);
        locks.calendar(id);
        return super.update(id, request);
    }

    @Override
    protected void beforeUpdate(Calendar entity, CalendarDTO request, ValidationContext ctx) {
        if (request.getClassId() != null && !request.getClassId().equals(entity.getClassId())) {
            ctx.add("classId", "A calendar cannot be moved to another class");
        }
        LocalDate start = request.getClassStartDate() != null ? request.getClassStartDate() : entity.getClassStartDate();
        LocalDate end = request.getClassEndDate() != null ? request.getClassEndDate() : entity.getClassEndDate();
        if (start == null && end == null) return; // External calendars resolve dates through the class API.
        rules.dates(start, end, ctx);
        if (!Objects.equals(start, entity.getClassStartDate())
                || !Objects.equals(end, entity.getClassEndDate())) {
            for (Session session : sessions.findAllByCalendarId(entity.getId())) {
                rules.session(session.getStartTime(), session.getEndTime(), start, end,
                        "versions[" + session.getCalendarVersionId() + "].sessions[" + session.getId() + "].", ctx);
            }
        }
    }

    @Override
    public void delete(Long id) {
        checkPermission(CrudAction.DELETE);
        locks.calendar(id);
        super.delete(id);
    }

    @Override
    protected void beforeDelete(Calendar entity) {
        if (versions.existsByCalendarId(entity.getId())) {
            throw new ConflictException("Delete draft versions before deleting the calendar");
        }
    }

    @Override
    public List<SessionDTO> events(Long id, LocalDateTime from, LocalDateTime to) {
        checkPermission(CrudAction.READ);
        check("SESSION_READ");
        if (from != null && to != null && !to.isAfter(from)) {
            throw new BadRequestException("to must be after from");
        }
        Calendar calendar = calendars.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar not found: " + id));
        var active = versions.findActiveVersionByCalendarId(id, CalendarVersionStatus.ACTIVE);
        if (active.isEmpty()) return List.of();
        return sessions.findByCalendarVersionIdOrderByStartTimeAscIdAsc(active.get().getId()).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .filter(s -> from == null || s.getEndTime().isAfter(from))
                .filter(s -> to == null || s.getStartTime().isBefore(to))
                .map(sessionMapper::toResponse).toList();
    }
}
