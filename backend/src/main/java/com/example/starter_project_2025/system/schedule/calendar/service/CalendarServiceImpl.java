package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarMapper;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarResponse;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarSummaryResponse;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CalendarServiceImpl implements CalendarService {

    private final CalendarRepository calendarRepository;
    private final ExternalApiService externalApiService;
    private final CalendarVersionRepository calendarVersionRepository;
    private final CalendarMapper calendarMapper;

    @Override
    @Transactional
    public CalendarResponse createCalendar(Long classId) {
        if (classId == null || classId <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_REQUEST: classId must be positive"
            );
        }

        ExternalClassDTO externalClass;

        try {
            externalClass = externalApiService.fetchClassById(classId);
        } catch (ExternalApiException exception) {
            if (exception.getStatusCode() == 404) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "CLASS_NOT_FOUND: " + classId,
                        exception
                );
            }

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Cannot retrieve Class from external system",
                    exception
            );
        }

        if (externalClass == null
                || !classId.equals(externalClass.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "External system returned invalid Class information"
            );
        }

        if (calendarRepository.existsByClassId(classId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "CALENDAR_ALREADY_EXISTS: " + classId
            );
        }

        Calendar calendar = Calendar.builder()
                .classId(classId)
                .name("Calendar - " + classId)
                .lastIssuedVersionNumber(0)
                .isActive(true)
                .build();

        Calendar savedCalendar = calendarRepository.save(calendar);

        return CalendarResponse.builder()
                .id(savedCalendar.getId())
                .classId(savedCalendar.getClassId())
                .lastIssuedVersionNumber(
                        savedCalendar.getLastIssuedVersionNumber()
                )
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CalendarSummaryResponse> getActiveCalendars() {
        List<Calendar> calendars =
                calendarRepository.findByIsActiveTrue();

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