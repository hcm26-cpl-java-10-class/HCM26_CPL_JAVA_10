package com.example.starter_project_2025.system.analytics.student;

import com.example.starter_project_2025.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/analytics/students")
@RequiredArgsConstructor
public class StudentAnalyticsController {
    private final StudentAnalyticsService service;

    @GetMapping
    @PreAuthorize("hasAuthority('STUDENT_ANALYTICS_READ') and (hasRole('ADMIN') or hasRole('TEACHER'))")
    public StudentAnalyticsService.Report getReport(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "MONTH") StudentAnalyticsService.Interval interval,
            @RequestParam(required = false) Long courseId
    ) {
        return service.report(principal, from, to, interval, courseId);
    }
}
