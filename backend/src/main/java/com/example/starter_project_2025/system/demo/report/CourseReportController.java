package com.example.starter_project_2025.system.demo.report;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
@Tag(name = "Course Report", description = "Course enrollment report APIs")
@RequiredArgsConstructor
public class CourseReportController {

    private final CourseReportService courseReportService;

    @GetMapping("/course-enrollments")
    @PreAuthorize("hasAnyAuthority('COURSE_REPORT_READ', 'COURSE_READ')")
    public List<CourseReportDTO> getCourseEnrollmentReport() {
        return courseReportService.getCourseReport();
    }
}
