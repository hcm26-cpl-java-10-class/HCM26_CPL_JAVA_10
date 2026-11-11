package com.example.starter_project_2025.system.training;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.time.LocalDate;

@Data
public class TrainingClassDTO {
    private Long id;
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    private Long enrolledTrainees;
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    private String traineeSource;
    @NotBlank @Pattern(regexp = "[A-Z0-9_-]{4,30}")
    private String code;
    @NotBlank @Size(max = 150)
    private String name;
    @NotBlank @Pattern(regexp = "planning|assigned|active|completed|closed|cancelled")
    private String status;
    @NotNull
    private LocalDate startDate;
    @NotNull
    private LocalDate endDate;
    @NotNull @Min(1) @Max(50)
    private Integer plannedSize;
    @Size(max = 255)
    private String site;
    @Size(max = 255)
    private String traineeType;
    @NotBlank @Size(max = 255)
    private String program;
    @NotBlank @Size(max = 255)
    private String classAdmin;
    @NotBlank @Size(max = 255)
    private String masterTrainer;
    @Size(max = 255)
    private String deliveryType;
    @Size(max = 255)
    private String formatType;
    @Size(max = 255)
    private String skills;
    @Size(max = 255)
    private String location;
}
