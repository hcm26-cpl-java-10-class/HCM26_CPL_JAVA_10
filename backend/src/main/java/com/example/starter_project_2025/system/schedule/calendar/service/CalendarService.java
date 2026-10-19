package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarSummaryResponse;

import java.util.List;

public interface CalendarService {

    List<CalendarSummaryResponse> getActiveCalendars();
}