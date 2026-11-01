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
    private List<String> categories;
    private String courseLevel;
    private int averageProgress;
    private long activeLearners;
    private long completedLearners;
    private int completionRate;
    private long certificatesIssued;
    private List<CourseLearnerReportDTO> learners;
}
