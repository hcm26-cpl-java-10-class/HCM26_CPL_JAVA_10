package com.example.starter_project_2025.system.schedule.calendar.service;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarResponse;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class CalendarServiceImpl implements CalendarService {

    private final CalendarRepository calendarRepository;
    private final ExternalApiService externalApiService;

    @Override
    @Transactional
    public CalendarResponse createCalendar(Long classId) {

        // 1. Kiểm tra classId hợp lệ
        if (classId == null || classId <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_REQUEST: classId must be positive"
            );
        }

        // 2. Kiểm tra Class tồn tại ở hệ thống tổng
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

        // Không tạo Calendar nếu dữ liệu trả về không đúng Class
        if (externalClass == null
                || !classId.equals(externalClass.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "External system returned invalid Class information"
            );
        }

        // 3. Chống tạo Calendar trùng
        if (calendarRepository.existsByClassId(classId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "CALENDAR_ALREADY_EXISTS: " + classId
            );
        }

        // 4. Tạo Calendar, chưa tạo Version hay Session
        Calendar calendar = Calendar.builder()
                .classId(classId)
                .lastIssuedVersionNumber(0)
                .isActive(true)
                .build();

        Calendar savedCalendar = calendarRepository.save(calendar);

        // 5. Chuyển Entity thành response
        return CalendarResponse.builder()
                .id(savedCalendar.getId())
                .classId(savedCalendar.getClassId())
                .lastIssuedVersionNumber(
                        savedCalendar.getLastIssuedVersionNumber()
                )
                .build();
    }
}