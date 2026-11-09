package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SaveExamTemplateRequest {

    @NotBlank
    @Size(max = 200)
    private String name;

    @Size(max = 1000)
    private String description;
}