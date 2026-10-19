package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.schedule.Session;
import com.example.starter_project_2025.system.schedule.SessionRepository;
import com.example.starter_project_2025.system.schedule.SessionStatus;
import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarRepository;
import com.example.starter_project_2025.system.schedule.calendar.repository.CalendarVersionRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Slf4j
@Order(12)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionDataInitializer implements CommandLineRunner {

    SessionRepository sessionRepository;
    CalendarRepository calendarRepository;
    CalendarVersionRepository calendarVersionRepository;

    @Override
    @Transactional
    public void run(String... args) {

        // Nếu đã có session thì không tạo lại dữ liệu demo.
        if (sessionRepository.count() > 0) {
            return;
        }

        // 1. Tìm hoặc tạo Calendar demo.
        // 1001L là classId giả vì dự án chưa có entity Class.
        Calendar calendar = calendarRepository
                .findByClassIdAndIsActiveTrue(1001L)
                .orElseGet(() -> calendarRepository.save(
                        Calendar.builder()
                                .classId(1001L)
                                .lastIssuedVersionNumber(0)
                                .isActive(true)
                                .build()
                ));

        // 2. Tìm version ACTIVE trước.
        CalendarVersion calendarVersion = calendarVersionRepository
                .findActiveVersionByCalendarId(
                        calendar.getId(),
                        CalendarVersionStatus.ACTIVE
                )
                .orElseGet(() -> findOrCreateDraftVersion(calendar));

        LocalDate tomorrow = LocalDate.now().plusDays(1);
        LocalDate dayAfterTomorrow = LocalDate.now().plusDays(2);

        // 3. Session mẫu thứ nhất.
        Session s1 = Session.builder()
                .calendarVersion(calendarVersion)
                .classCode("HCM26-FSJ-01")
                .topicName("Java Spring Framework")
                .title("Java Spring Core & RESTful API")
                .trainerId(1L)
                .trainerName("Nguyen Minh (Trainer)")
                .startTime(LocalDateTime.of(
                        tomorrow, LocalTime.of(8, 30)))
                .endTime(LocalDateTime.of(
                        tomorrow, LocalTime.of(11, 30)))
                .room("Phòng A-301")
                .meetingLink("https://meet.google.com/fsj-session1")
                .status(SessionStatus.SCHEDULED)
                .notes("Học viên chuẩn bị sẵn JDK 21 và Intellij IDEA.")
                .isOverridden(false)
                .isActive(true)
                .build();

        // 4. Session mẫu thứ hai.
        Session s2 = Session.builder()
                .calendarVersion(calendarVersion)
                .classCode("HN26-QAA-02")
                .topicName("QA Automation")
                .title("Selenium WebDriver & TestNG Basics")
                .trainerId(2L)
                .trainerName("Tran Thi Lan (Trainer)")
                .startTime(LocalDateTime.of(
                        tomorrow, LocalTime.of(13, 30)))
                .endTime(LocalDateTime.of(
                        tomorrow, LocalTime.of(16, 30)))
                .room("Phòng B-202")
                .meetingLink("https://meet.google.com/qaa-session2")
                .status(SessionStatus.SCHEDULED)
                .notes("Mang theo máy tính cá nhân đã cài ChromeDriver.")
                .isOverridden(false)
                .isActive(true)
                .build();

        // 5. Session mẫu thứ ba: buổi học bù đã override.
        Session s3 = Session.builder()
                .calendarVersion(calendarVersion)
                .classCode("DN26-DATA-01")
                .topicName("SQL Fundamentals")
                .title("Indexing & Query Optimization (Học bù)")
                .trainerId(1L)
                .trainerName("Nguyen Minh (Trainer)")
                .startTime(LocalDateTime.of(
                        dayAfterTomorrow, LocalTime.of(9, 0)))
                .endTime(LocalDateTime.of(
                        dayAfterTomorrow, LocalTime.of(11, 30)))
                .room("Phòng A-105")
                .meetingLink("https://meet.google.com/data-session3")
                .status(SessionStatus.SCHEDULED)
                .notes("Buổi học bù theo đề xuất của Operator.")
                .isOverridden(true)
                .overrideReason(
                        "Học bù đột xuất theo yêu cầu Operator đã được phê duyệt (BR-10)")
                .isActive(true)
                .build();

        // 6. Lưu ba session.
        sessionRepository.save(s1);
        sessionRepository.save(s2);
        sessionRepository.save(s3);

        log.info(
                "Initialized 3 sample sessions with CalendarVersion ID={}",
                calendarVersion.getId()
        );
    }

    private CalendarVersion findOrCreateDraftVersion(Calendar calendar) {

        // Tái sử dụng DRAFT nếu đã tồn tại.
        return calendarVersionRepository
                .findFirstByCalendar_IdAndStatusAndIsActiveTrueOrderByVersionNumberDesc(
                        calendar.getId(),
                        CalendarVersionStatus.DRAFT
                )
                .orElseGet(() -> {

                    Integer lastVersion =
                            calendar.getLastIssuedVersionNumber();

                    int nextVersion =
                            (lastVersion == null ? 0 : lastVersion) + 1;

                    calendar.setLastIssuedVersionNumber(nextVersion);
                    calendarRepository.save(calendar);

                    CalendarVersion draft = CalendarVersion.builder()
                            .calendar(calendar)
                            .versionNumber(nextVersion)
                            .status(CalendarVersionStatus.DRAFT)
                            .name("Draft calendar version " + nextVersion)
                            .description("Demo draft calendar version.")
                            .isActive(true)
                            .build();

                    return calendarVersionRepository.save(draft);
                });
    }
}
