package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.schedule.Session;
import com.example.starter_project_2025.system.schedule.SessionRepository;
import com.example.starter_project_2025.system.schedule.SessionStatus;
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

    @Override
    @Transactional
    public void run(String... args) {
        if (sessionRepository.count() > 0) {
            return;
        }

        LocalDate tomorrow = LocalDate.now().plusDays(1);
        LocalDate dayAfterTomorrow = LocalDate.now().plusDays(2);

        // Buổi 1: Lớp HCM26-FSJ-01 (Trainer Minh, Phòng A-301, sáng mai)
        Session s1 = Session.builder()
                .classCode("HCM26-FSJ-01")
                .topicName("Java Spring Framework")
                .title("Java Spring Core & RESTful API")
                .trainerId(1L)
                .trainerName("Nguyen Minh (Trainer)")
                .startTime(LocalDateTime.of(tomorrow, LocalTime.of(8, 30)))
                .endTime(LocalDateTime.of(tomorrow, LocalTime.of(11, 30)))
                .room("Phòng A-301")
                .meetingLink("https://meet.google.com/fsj-session1")
                .status(SessionStatus.SCHEDULED)
                .notes("Học viên chuẩn bị sẵn JDK 21 và Intellij IDEA.")
                .isOverridden(false)
                .isActive(true)
                .build();

        // Buổi 2: Lớp HN26-QAA-02 (Trainer Lan, Phòng B-202, chiều mai)
        Session s2 = Session.builder()
                .classCode("HN26-QAA-02")
                .topicName("QA Automation")
                .title("Selenium WebDriver & TestNG Basics")
                .trainerId(2L)
                .trainerName("Tran Thi Lan (Trainer)")
                .startTime(LocalDateTime.of(tomorrow, LocalTime.of(13, 30)))
                .endTime(LocalDateTime.of(tomorrow, LocalTime.of(16, 30)))
                .room("Phòng B-202")
                .meetingLink("https://meet.google.com/qaa-session2")
                .status(SessionStatus.SCHEDULED)
                .notes("Mang theo máy tính cá nhân đã cài ChromeDriver.")
                .isOverridden(false)
                .isActive(true)
                .build();

        // Buổi 3: Lớp DN26-DATA-01 (Trainer Minh - Đã từng override)
        Session s3 = Session.builder()
                .classCode("DN26-DATA-01")
                .topicName("SQL Fundamentals")
                .title("Indexing & Query Optimization (Học bù)")
                .trainerId(1L)
                .trainerName("Nguyen Minh (Trainer)")
                .startTime(LocalDateTime.of(dayAfterTomorrow, LocalTime.of(9, 0)))
                .endTime(LocalDateTime.of(dayAfterTomorrow, LocalTime.of(11, 30)))
                .room("Phòng A-105")
                .meetingLink("https://meet.google.com/data-session3")
                .status(SessionStatus.SCHEDULED)
                .notes("Buổi học bù theo đề xuất của Operator.")
                .isOverridden(true)
                .overrideReason("Học bù đột xuất theo yêu cầu Operator đã được phê duyệt (BR-10)")
                .isActive(true)
                .build();

        sessionRepository.save(s1);
        sessionRepository.save(s2);
        sessionRepository.save(s3);

        log.info("Initialized 3 sample class sessions for Schedule Conflict Detection demo.");
    }
}
