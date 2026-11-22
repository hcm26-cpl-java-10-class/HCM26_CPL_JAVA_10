package com.example.starter_project_2025.system.demo.syllabus.dto.response;

import java.util.List;

/** REST response shape retained from the original Course Usage endpoint. */
public final class SyllabusCourseUsageModels {
    private SyllabusCourseUsageModels() {}
    public record CourseCandidate(Long id, String name, String status, boolean active) {}
    public record CourseLink(Long id, String name, String status, boolean active) {}
    public record UsageRow(Long syllabusId, String syllabusCode, String syllabusName,
                           String syllabusStatus, boolean syllabusActive, int courseCount,
                           List<CourseLink> courses) {}
}
