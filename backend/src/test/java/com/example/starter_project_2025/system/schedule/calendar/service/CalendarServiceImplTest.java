package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarResponse;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.example.starter_project_2025.system.schedule.calendar.CalendarMapper;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;


import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CalendarServiceImplTest {

    private CalendarRepository calendarRepository;
    private ExternalApiService externalApiService;
    private CalendarServiceImpl calendarService;

    @BeforeEach
    void setUp() {
        calendarRepository = mock(CalendarRepository.class);
        externalApiService = mock(ExternalApiService.class);

        calendarService = new CalendarServiceImpl(
                calendarRepository,
                externalApiService,
                mock(CalendarVersionRepository.class),
                mock(CalendarMapper.class)
        );
    }

    @Test
    void shouldCreateCalendarForExistingClass() {
        ExternalClassDTO externalClass = ExternalClassDTO.builder()
                .id(10L)
                .build();

        when(externalApiService.fetchClassById(10L))
                .thenReturn(externalClass);
        when(calendarRepository.existsByClassId(10L))
                .thenReturn(false);

        when(calendarRepository.save(any(Calendar.class)))
                .thenAnswer(invocation -> {
                    Calendar calendar = invocation.getArgument(0);
                    calendar.setId(100L);
                    return calendar;
                });

        CalendarResponse response = calendarService.createCalendar(10L);

        assertEquals(100L, response.getId());
        assertEquals(10L, response.getClassId());
        assertEquals(Integer.valueOf(0),
                response.getLastIssuedVersionNumber());

        ArgumentCaptor<Calendar> captor =
                ArgumentCaptor.forClass(Calendar.class);

        verify(calendarRepository).save(captor.capture());



        Calendar saved = captor.getValue();
        assertEquals("Calendar - 10", saved.getName());
        assertEquals(10L, saved.getClassId());
        assertEquals(Boolean.TRUE, saved.getIsActive());
        assertEquals(Integer.valueOf(0),
                saved.getLastIssuedVersionNumber());
    }

    @Test
    void shouldRejectDuplicateCalendar() {
        when(externalApiService.fetchClassById(10L))
                .thenReturn(ExternalClassDTO.builder().id(10L).build());
        when(calendarRepository.existsByClassId(10L))
                .thenReturn(true);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> calendarService.createCalendar(10L)
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(calendarRepository, never()).save(any(Calendar.class));
    }

    @Test
    void shouldRejectClassNotFound() {
        when(externalApiService.fetchClassById(10L))
                .thenThrow(new ExternalApiException(
                        "Class not found", 404, ""
                ));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> calendarService.createCalendar(10L)
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        verifyNoInteractions(calendarRepository);
    }

    @Test
    void shouldNotCreateCalendarWhenExternalApiIsUnavailable() {
        when(externalApiService.fetchClassById(10L))
                .thenThrow(new ExternalApiException("Connection failed"));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> calendarService.createCalendar(10L)
        );

        assertEquals(HttpStatus.BAD_GATEWAY, exception.getStatusCode());
        verifyNoInteractions(calendarRepository);
    }

    @Test
    void shouldRejectInvalidClassIds() {
        Long[] invalidIds = {null, 0L, -1L};

        for (Long classId : invalidIds) {
            ResponseStatusException exception = assertThrows(
                    ResponseStatusException.class,
                    () -> calendarService.createCalendar(classId)
            );

            assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        }

        verifyNoInteractions(externalApiService, calendarRepository);
    }

    @Test
    void shouldRejectMismatchedClassFromExternalApi() {
        when(externalApiService.fetchClassById(10L))
                .thenReturn(ExternalClassDTO.builder().id(99L).build());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> calendarService.createCalendar(10L)
        );

        assertEquals(HttpStatus.BAD_GATEWAY, exception.getStatusCode());
        verifyNoInteractions(calendarRepository);
    }

}