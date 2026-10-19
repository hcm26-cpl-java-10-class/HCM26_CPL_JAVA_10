package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarMapper;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarSummaryResponse;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CalendarServiceImpl implements CalendarService {

    private final CalendarRepository calendarRepository;
    private final CalendarVersionRepository calendarVersionRepository;
    private final CalendarMapper calendarMapper;

    @Override
    @Transactional(readOnly = true)
    public List<CalendarSummaryResponse> getActiveCalendars() {
        List<Calendar> calendars = calendarRepository.findByIsActiveTrue();

        if (calendars.isEmpty()) {
            return List.of();
        }

        List<Long> calendarIds = calendars.stream()
                .map(Calendar::getId)
                .toList();

        Map<Long, Integer> activeVersionNumbers =
                calendarVersionRepository
                        .findByCalendar_IdInAndStatusAndIsActiveTrue(
                                calendarIds,
                                CalendarVersionStatus.ACTIVE
                        )
                        .stream()
                        .collect(Collectors.toMap(
                                version -> version.getCalendar().getId(),
                                CalendarVersion::getVersionNumber
                        ));

        return calendars.stream()
                .map(calendar -> {
                    CalendarSummaryResponse response =
                            calendarMapper.toSummaryResponse(calendar);
                    response.setActiveVersionNumber(
                            activeVersionNumbers.get(calendar.getId())
                    );
                    return response;
                })
                .toList();
    }
}