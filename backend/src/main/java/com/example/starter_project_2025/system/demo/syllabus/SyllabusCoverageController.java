package com.example.starter_project_2025.system.demo.syllabus;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/syllabuses/{syllabusId}")
@RequiredArgsConstructor
public class SyllabusCoverageController {
    private final SyllabusCoverageService service;

    @GetMapping("/coverage")
    @PreAuthorize("hasAuthority('SYLLABUS_READ')")
    public SyllabusCoverageService.CoverageView get(@PathVariable Long syllabusId) {
        return service.get(syllabusId);
    }

    @PutMapping("/topics/{topicId}/clos")
    @PreAuthorize("hasAuthority('SYLLABUS_UPDATE')")
    public SyllabusCoverageService.CoverageView setTopicClos(
            @PathVariable Long syllabusId,
            @PathVariable Long topicId,
            @RequestBody SyllabusCoverageService.TopicLinkInput input) {
        return service.setTopicClos(syllabusId, topicId, input);
    }
}
