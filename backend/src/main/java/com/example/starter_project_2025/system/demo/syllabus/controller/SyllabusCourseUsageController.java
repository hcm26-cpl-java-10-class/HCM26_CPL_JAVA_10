package com.example.starter_project_2025.system.demo.syllabus.controller;


import com.example.starter_project_2025.system.demo.syllabus.dto.response.SyllabusCourseUsageModels.UsageRow;
import com.example.starter_project_2025.system.demo.syllabus.service.SyllabusCourseUsageService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** HTTP-only endpoint; SQL and grouping live in Repository + Service. */
@RestController
@RequestMapping("/api/syllabuses/course-usage")
@RequiredArgsConstructor
public class SyllabusCourseUsageController {
    private final SyllabusCourseUsageService service;

    @GetMapping
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_READ')")
    public List<UsageRow> listUsage() {
        return service.listUsage();
    }
}
