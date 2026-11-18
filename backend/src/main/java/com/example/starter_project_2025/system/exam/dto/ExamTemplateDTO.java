package com.example.starter_project_2025.system.exam.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
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
    private List<ExamTemplateQuestionDTO> questions = new ArrayList<>();
}
