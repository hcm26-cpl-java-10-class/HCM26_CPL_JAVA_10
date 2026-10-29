package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
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
@Order(13)
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

        LocalDate today = LocalDate.now();
        // Tìm ngày Thứ Hai của tuần hiện tại
        LocalDate monday = today.minusDays((today.getDayOfWeek().getValue() - 1));

        // Buổi 1: Thứ Hai - Slot 1 (07:00 - 09:15) - Lớp 1 - Java OOP
        sessionRepository.save(Session.builder()
                .classId(1L)
                .topicId(1L)
                .trainerId(3L) // Teacher
                .title("Java Core: OOP & Clean Architecture")
                .location("Lab 201 - F-Town 2")
                .startTime(LocalDateTime.of(monday, LocalTime.of(7, 0)))
                .endTime(LocalDateTime.of(monday, LocalTime.of(9, 15)))
                .status(Session.SessionStatus.COMPLETED)
                .note("Buổi học đầu tuần. Đã hoàn thành điểm danh và bài tập lab 1.")
                .build());

        // Buổi 2: Thứ Ba - Slot 2 (09:30 - 11:45) - Lớp 1 - Database Design
        sessionRepository.save(Session.builder()
                .classId(1L)
                .topicId(2L)
                .trainerId(3L) // Teacher
                .title("Database: MySQL Schema & Normalization")
                .location("Lab 201 - F-Town 2")
                .startTime(LocalDateTime.of(monday.plusDays(1), LocalTime.of(9, 30)))
                .endTime(LocalDateTime.of(monday.plusDays(1), LocalTime.of(11, 45)))
                .status(Session.SessionStatus.COMPLETED)
                .note("Thực hành thiết kế CSDL quan hệ và tối ưu chỉ mục.")
                .build());

        // Buổi 3: Thứ Tư (Hôm nay) - Slot 1 (07:00 - 09:15) - Lớp 1 - Spring Boot REST API
        sessionRepository.save(Session.builder()
                .classId(1L)
                .topicId(3L)
                .trainerId(3L) // Teacher
                .title("Spring Boot: Controller, Service & DTO Pattern")
                .location("Room 304 - Innovation Hall")
                .startTime(LocalDateTime.of(monday.plusDays(2), LocalTime.of(7, 0)))
                .endTime(LocalDateTime.of(monday.plusDays(2), LocalTime.of(9, 15)))
                .status(Session.SessionStatus.SCHEDULED)
                .note("Hướng dẫn viết RESTful API và validation dữ liệu đầu vào.")
                .build());

        // Buổi 4: Thứ Tư (Hôm nay) - Slot 3 (12:30 - 14:45) - Lớp 2 - React Frontend
        sessionRepository.save(Session.builder()
                .classId(2L)
                .topicId(4L)
                .trainerId(1L) // Admin / Lead
                .title("React & TypeScript: State Management & Hooks")
                .location("Online Zoom Room A")
                .meetingUrl("https://meet.google.com/xyz-mock-exam")
                .startTime(LocalDateTime.of(monday.plusDays(2), LocalTime.of(12, 30)))
                .endTime(LocalDateTime.of(monday.plusDays(2), LocalTime.of(14, 45)))
                .status(Session.SessionStatus.SCHEDULED)
                .note("Học trực tuyến. Sinh viên chuẩn bị sẵn môi trường Node.js và Vite.")
                .build());

        // Buổi 5: Thứ Năm - Slot 2 (09:30 - 11:45) - Lớp 1 - Spring Security & JWT
        sessionRepository.save(Session.builder()
                .classId(1L)
                .topicId(3L)
                .trainerId(3L) // Teacher
                .title("Spring Security: JWT Authentication & RBAC")
                .location("Room 304 - Innovation Hall")
                .startTime(LocalDateTime.of(monday.plusDays(3), LocalTime.of(9, 30)))
                .endTime(LocalDateTime.of(monday.plusDays(3), LocalTime.of(11, 45)))
                .status(Session.SessionStatus.SCHEDULED)
                .note("Cơ chế phân quyền người dùng và bảo mật API.")
                .build());

        // Buổi 6: Thứ Sáu - Slot 4 (15:00 - 17:15) - Lớp 1 - Weekly Review & Quiz
        sessionRepository.save(Session.builder()
                .classId(1L)
                .topicId(5L)
                .trainerId(3L) // Teacher
                .title("Mock Project Phase 1 Review & Q&A")
                .location("Hall B - Tech Center")
                .startTime(LocalDateTime.of(monday.plusDays(4), LocalTime.of(15, 0)))
                .endTime(LocalDateTime.of(monday.plusDays(4), LocalTime.of(17, 15)))
                .status(Session.SessionStatus.SCHEDULED)
                .note("Đánh giá tiến độ đồ án tuần 1.")
                .build());

        // Buổi 7: Buổi đã bị hủy (CANCELLED) để test filter trạng thái
        sessionRepository.save(Session.builder()
                .classId(1L)
                .topicId(2L)
                .trainerId(3L)
                .title("Thực hành ngoài giờ: Tối ưu SQL nâng cao")
                .location("Lab 201 - F-Town 2")
                .startTime(LocalDateTime.of(monday.plusDays(1), LocalTime.of(15, 0)))
                .endTime(LocalDateTime.of(monday.plusDays(1), LocalTime.of(17, 15)))
                .status(Session.SessionStatus.CANCELLED)
                .cancelReason("Bảo trì hệ thống mạng phòng máy")
                .note("Buổi học được chuyển sang tuần kế tiếp.")
                .build());

        log.info("Initialized sample sessions for Calendar testing (Weekly, Monthly, and Personal Schedule).");
    }
}
