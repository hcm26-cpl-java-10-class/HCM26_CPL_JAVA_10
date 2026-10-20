package com.example.starter_project_2025.system.schedule.calendar.crud;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.session.SessionRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class CalendarLock {
    private final CalendarRepository calendars;
    private final CalendarVersionRepository versions;
    private final SessionRepository sessions;
    private final EntityManager entityManager;

    public Calendar calendar(Long id) {
        if (id == null) throw new BadRequestException("Calendar ID is required");
        Calendar calendar = calendars.findForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar not found: " + id));
        // A caller may already have loaded the calendar in this persistence context.
        entityManager.refresh(calendar, LockModeType.PESSIMISTIC_WRITE);
        if (!Boolean.TRUE.equals(calendar.getIsActive())) {
            throw new ResourceNotFoundException("Calendar not found: " + id);
        }
        return calendar;
    }

    public CalendarVersion version(Long id) {
        if (id == null) throw new BadRequestException("Calendar version ID is required");
        Long calendarId = versions.findCalendarId(id)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar version not found: " + id));
        Calendar calendar = calendar(calendarId);
        CalendarVersion version = versions.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar version not found: " + id));
        entityManager.refresh(version);
        if (!Boolean.TRUE.equals(version.getIsActive())) {
            throw new ResourceNotFoundException("Calendar version not found: " + id);
        }
        version.setCalendar(calendar);
        return version;
    }

    public CalendarVersion session(Long id) {
        Long versionId = sessions.findCalendarVersionId(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found: " + id));
        return version(versionId);
    }
}
