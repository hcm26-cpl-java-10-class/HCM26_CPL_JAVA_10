package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(11)
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CalendarDemoDataInitializer implements CommandLineRunner {

    CalendarRepository calendarRepository;
    CalendarVersionRepository calendarVersionRepository;

    @Override
    @Transactional
    public void run(String... args) {
        // 1. Tạo hoặc lấy Calendar demo
        Calendar calendar = calendarRepository
                .findByClassIdAndIsActiveTrue(1001L)
                .orElseGet(() -> calendarRepository.save(
                        Calendar.builder()
                                .classId(1001L)
                                .lastIssuedVersionNumber(0)
                                .isActive(true)
                                .build()
                ));

        // 2. Ưu tiên sử dụng version ACTIVE hiện có
        CalendarVersion version = calendarVersionRepository
                .findActiveVersionByCalendarId(
                        calendar.getId(),
                        CalendarVersionStatus.ACTIVE
                )
                .orElseGet(() -> createDraftVersion(calendar));

        // Chỉ log để xác nhận dữ liệu đã sẵn sàng
        System.out.println(
                "Calendar demo ready: calendarId=" + calendar.getId()
                        + ", versionId=" + version.getId()
                        + ", status=" + version.getStatus()
        );
    }

    private CalendarVersion createDraftVersion(Calendar calendar) {
        // Nếu đã có DRAFT thì dùng lại, tránh tạo trùng khi restart.
        return calendarVersionRepository
                .findFirstByCalendar_IdAndStatusAndIsActiveTrueOrderByVersionNumberDesc(
                        calendar.getId(),
                        CalendarVersionStatus.DRAFT
                )
                .orElseGet(() -> {
                    Integer lastIssued =
                            calendar.getLastIssuedVersionNumber();

                    int nextVersion =
                            (lastIssued == null ? 0 : lastIssued) + 1;

                    calendar.setLastIssuedVersionNumber(nextVersion);
                    calendarRepository.save(calendar);

                    CalendarVersion draft = CalendarVersion.builder()
                            .calendar(calendar)
                            .versionNumber(nextVersion)
                            .status(CalendarVersionStatus.DRAFT)
                            .isActive(true)
                            .build();

                    return calendarVersionRepository.save(draft);
                });
    }
}
