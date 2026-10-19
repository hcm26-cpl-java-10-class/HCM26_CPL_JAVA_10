package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarResponse;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarSummaryResponse;

import java.util.List;

public interface CalendarService {

    CalendarResponse createCalendar(Long classId);

    List<CalendarSummaryResponse> getActiveCalendars();
}