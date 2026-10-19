package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarResponse;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.example.starter_project_2025.system.schedule.calendar.CalendarMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@DataJpaTest
@Import(CalendarServiceImpl.class)
class CalendarCreationIntegrationTest {

    @MockBean
    private CalendarMapper calendarMapper;

    @Autowired
    private CalendarServiceImpl calendarService;

    @Autowired
    private CalendarRepository calendarRepository;

    @MockBean
    private ExternalApiService externalApiService;

    @Test
    void shouldPersistCalendarForExistingClass() {
        Long classId = 900001L;

        when(externalApiService.fetchClassById(classId))
                .thenReturn(ExternalClassDTO.builder()
                        .id(classId)
                        .build());

        CalendarResponse response =
                calendarService.createCalendar(classId);

        calendarRepository.flush();

        Calendar stored = calendarRepository
                .findByClassIdAndIsActiveTrue(classId)
                .orElseThrow();

        assertNotNull(response.getId());
        assertEquals(response.getId(), stored.getId());
        assertEquals(classId, stored.getClassId());
        assertEquals(Integer.valueOf(0),
                stored.getLastIssuedVersionNumber());
        assertEquals(Boolean.TRUE, stored.getIsActive());
    }

    @Test
    void shouldRejectSecondCalendarForSameClass() {
        Long classId = 900002L;

        when(externalApiService.fetchClassById(classId))
                .thenReturn(ExternalClassDTO.builder()
                        .id(classId)
                        .build());

        CalendarResponse first =
                calendarService.createCalendar(classId);

        calendarRepository.flush();
        long countBefore = calendarRepository.count();

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> calendarService.createCalendar(classId)
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertEquals(countBefore, calendarRepository.count());

        Calendar stored = calendarRepository
                .findByClassIdAndIsActiveTrue(classId)
                .orElseThrow();

        assertEquals(first.getId(), stored.getId());
    }

    @Test
    void shouldNotPersistCalendarWhenClassDoesNotExist() {
        Long classId = 900003L;
        long countBefore = calendarRepository.count();

        when(externalApiService.fetchClassById(classId))
                .thenThrow(new ExternalApiException(
                        "Class not found", 404, ""
                ));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> calendarService.createCalendar(classId)
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertFalse(calendarRepository.existsByClassId(classId));
        assertEquals(countBefore, calendarRepository.count());
    }
}