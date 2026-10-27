package com.example.starter_project_2025.system.exam.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateExamFromTemplateRequest {

    @NotBlank
    @Size(max = 200)
    private String title;

    private LocalDateTime startTime;
    private LocalDateTime endTime;
}