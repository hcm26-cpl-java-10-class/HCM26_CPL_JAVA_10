package com.example.starter_project_2025.system.demo.report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourseReportDTO {
    private Long courseId;
    private String courseName;
    private String instructor;
    private String courseStatus;
    private Long studentCount;
    private List<String> students;
}