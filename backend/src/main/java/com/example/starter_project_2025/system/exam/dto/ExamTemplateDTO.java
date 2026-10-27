package com.example.starter_project_2025.system.exam.dto;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExamTemplateDTO {

    private Long id;
    private String name;
    private String description;
    private Integer durationMinutes;
    private Integer maxAttempts;
    private Integer questionCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}