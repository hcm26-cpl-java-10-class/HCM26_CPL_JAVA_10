package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionFilter;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarVersionResponse;
import com.example.starter_project_2025.system.schedule.calendar.dto.CreateCalendarVersionRequest;
import com.example.starter_project_2025.system.schedule.calendar.dto.UpdateCalendarVersionRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CalendarVersionService {

    CalendarVersionResponse createVersion(
            Long calendarId,
            CreateCalendarVersionRequest request
    );

    Page<CalendarVersionResponse> getVersions(
            Long calendarId,
            CalendarVersionFilter filter,
            Pageable pageable
    );

    CalendarVersionResponse updateVersion(
            Long calendarId,
            Long versionId,
            UpdateCalendarVersionRequest request
    );

    void deleteVersion(Long calendarId, Long versionId);
}
