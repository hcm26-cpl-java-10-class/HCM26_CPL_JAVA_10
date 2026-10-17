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

        Calendar calendar = calendarRepository
                .findByClassIdAndIsActiveTrue(1001L)
                .orElseGet(() -> calendarRepository.save(
                        Calendar.builder()
                                .classId(1001L)
                                .name("Fall Semester 2026")
                                .description("Academic calendar for Fall Semester 2026.")
                                .lastIssuedVersionNumber(0)
                                .isActive(true)
                                .build()
                ));
        final Calendar currentCalendar = calendar;


        CalendarVersion version = calendarVersionRepository
                .findActiveVersionByCalendarId(
                        currentCalendar.getId(),
                        CalendarVersionStatus.ACTIVE
                )
                .orElseGet(() -> createInitialActiveVersion(currentCalendar));

        System.out.println(
                "Calendar demo ready: calendarId=" + currentCalendar.getId()
                        + ", versionId=" + version.getId()
                        + ", status=" + version.getStatus()
        );

        Calendar calendarWithoutActiveVersion = calendarRepository
                .findByClassIdAndIsActiveTrue(1002L)
                .orElseGet(() -> Calendar.builder()
                        .classId(1002L)
                        .lastIssuedVersionNumber(0)
                        .isActive(true)
                        .build());

        calendarWithoutActiveVersion.setName("Spring Semester 2027");
        calendarWithoutActiveVersion.setDescription(
                "Academic calendar without an active version.");
        calendarRepository.save(calendarWithoutActiveVersion);
    }

    private CalendarVersion createInitialActiveVersion(Calendar calendar) {
        // Promote an existing demo draft so its sessions remain attached.
        return calendarVersionRepository
                .findFirstByCalendar_IdAndStatusAndIsActiveTrueOrderByVersionNumberDesc(
                        calendar.getId(),
                        CalendarVersionStatus.DRAFT
                )
                .map(draft -> {
                    draft.setStatus(CalendarVersionStatus.ACTIVE);
                    return calendarVersionRepository.save(draft);
                })
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
                            .status(CalendarVersionStatus.ACTIVE)
                            .isActive(true)
                            .build();

                    return calendarVersionRepository.save(draft);
                });
    }

}
