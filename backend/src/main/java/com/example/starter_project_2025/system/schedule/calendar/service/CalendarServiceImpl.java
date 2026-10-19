package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarSummaryResponse;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CalendarServiceImpl implements CalendarService {

    CalendarRepository calendarRepository;
    CalendarVersionRepository calendarVersionRepository;

    @Override
    @Transactional(readOnly = true)
    public List<CalendarSummaryResponse> getActiveCalendars() {
        List<Calendar> calendars = calendarRepository.findByIsActiveTrue();

        if (calendars.isEmpty()) {
            return List.of();
        }

        List<Long> calendarIds = calendars.stream().map(Calendar::getId).toList();

        List<CalendarVersion> activeVersions = calendarVersionRepository
                .findByCalendar_IdInAndStatusAndIsActiveTrue(calendarIds, CalendarVersionStatus.ACTIVE);

        Map<Long, Integer> activeVersionMap = activeVersions.stream()
                .collect(Collectors.toMap(
                        v -> v.getCalendar().getId(),
                        CalendarVersion::getVersionNumber,
                        (v1, v2) -> v1
                ));

        return calendars.stream().map(calendar -> new CalendarSummaryResponse(
                calendar.getClassId(),
                calendar.getName(),
                calendar.getDescription(),
                activeVersionMap.get(calendar.getId())
        )).toList();
    }
}