package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Order(13)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CourseDataInitializer implements CommandLineRunner {

    CourseRepository courseRepository;
    SubjectRepository subjectRepository;

    @Override
    @Transactional
    public void run(String... args) {
        upsertCourseForSubject("JAVA_CORE", "1.0", "CRS-JAVA-101",
                "Java Core & OOP Online Foundation",
                "Giảng viên mẫu An",
                "Học liệu LMS chính thức môn Java Core: OOP, Collections, Generics và Exception Handling.",
                true);
        upsertCourseForSubject("JAVA_CORE", "1.0", "CRS-JAVA-102",
                "Java Core Intensive Coding Labs",
                "Giảng viên mẫu Bình",
                "Bộ bài tập thực hành nâng cao và chấm tự động cho Topic Java Core.",
                true);
        upsertCourseForSubject("JAVA_CORE", "1.0", "CRS-JAVA-OLD",
                "Java Core Legacy 2023 (Archived)",
                "Giảng viên mẫu An",
                "Phiên bản học liệu cũ đã ngừng sử dụng.",
                false);

        upsertCourseForSubject("DATABASE_SQL", "1.0", "CRS-SQL-101",
                "Relational Database & SQL Optimization LMS",
                "Giảng viên mẫu Bình",
                "Học liệu thiết kế ERD, chuẩn hóa dữ liệu, transaction và tối ưu truy vấn SQL.",
                true);
        upsertCourseForSubject("DATABASE_SQL", "1.0", "CRS-SQL-102",
                "SQL Hands-on Workshop & Stored Procedures",
                "Giảng viên mẫu An",
                "Thực hành truy vấn nâng cao, indexing và phân tích execution plan.",
                true);

        upsertCourseForSubject("SPRING_BOOT", "1.0", "CRS-SB-101",
                "Spring Boot 3 Enterprise REST & Security",
                "Giảng viên mẫu An",
                "Học liệu xây dựng RESTful API, Spring Data JPA, Validation và JWT Security.",
                true);
        upsertCourseForSubject("SPRING_BOOT", "1.0", "CRS-SB-102",
                "Spring Boot Testing & Clean Architecture",
                "Giảng viên mẫu Bình",
                "Thiết kế kiến trúc phân lớp, tích hợp external service và kiểm thử tự động.",
                true);

        upsertCourseForSubject("REACT_FRONTEND", "1.0", "CRS-REACT-101",
                "React & TypeScript Modern SPA",
                "Giảng viên mẫu Bình",
                "Học liệu phát triển ứng dụng React, Hooks, Router và tích hợp REST API.",
                true);

        upsertCourseForSubject("DEVOPS_BASIC", "1.0", "CRS-DEVOPS-101",
                "Docker & CI/CD Pipeline Essentials",
                "Giảng viên mẫu An",
                "Đóng gói ứng dụng với Docker Compose và thiết lập quy trình CI/CD cơ bản.",
                true);

        upsertCourseForSubject("TESTING_QA", "1.0", "CRS-QA-101",
                "JUnit 5 & Automated API Testing",
                "Giảng viên mẫu Bình",
                "Kiểm thử đơn vị và tích hợp với JUnit 5, Mockito và MockMvc.",
                true);

        log.info("Ensured sample LMS Course data linked to Subjects (Topics).");
    }

    private void upsertCourseForSubject(String subjectCode, String subjectVersion, String courseCode,
                                        String courseName, String instructor, String description, boolean active) {
        subjectRepository.findByCodeAndVersion(subjectCode, subjectVersion).ifPresent(subject -> {
            Course course = courseRepository.findByCode(courseCode).orElseGet(() ->
                    courseRepository.existsByName(courseName) ? null : new Course());
            if (course == null) {
                return;
            }
            course.setCode(courseCode);
            course.setSubjectId(subject.getId());
            course.setName(courseName);
            course.setInstructor(instructor);
            course.setDescription(description);
            course.setIsActive(active);
            courseRepository.save(course);
        });
    }
}

