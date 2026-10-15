package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarVersionResponse;
import com.example.starter_project_2025.system.schedule.calendar.dto.CreateCalendarVersionRequest;

public interface CalendarVersionService {

    CalendarVersionResponse createVersion(
            Long calendarId,
            CreateCalendarVersionRequest request
    );
}
