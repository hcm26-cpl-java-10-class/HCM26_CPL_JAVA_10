package com.example.starter_project_2025.system.schedule.trainingclass.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Max;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.example.starter_project_2025.system.schedule.trainingclass.TrainingClassRules;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
public class UpdateTrainingClassRequest {

    @NotNull(message = "Class version is required. Reload the class before editing.")
    @PositiveOrZero(message = "Class version must not be negative")
    private Long version;

    @NotNull(message = "Draft revision ID is required")
    @Positive
    private Long revisionId;

    @NotNull(message = "Draft revision version is required")
    @PositiveOrZero
    private Long revisionVersion;

    @NotBlank(message = "Class code is required")
    @Size(max = 255, message = "Class code must not exceed 255 characters")
    private String code;

    @NotBlank(message = "Class name is required")
    @Size(max = 255, message = "Class name must not exceed 255 characters")
    private String name;

    @Size(max = 2000, message = "Description must not exceed 2000 characters")
    private String description;

    @NotBlank(message = "Trainee type is required")
    @Size(max = 255, message = "Trainee type must not exceed 255 characters")
    private String traineeType;

    @NotBlank(message = "Delivery format is required")
    @Size(max = 255, message = "Delivery format must not exceed 255 characters")
    private String deliveryFormat;

    @NotBlank(message = "Site is required")
    @Size(max = 255, message = "Site must not exceed 255 characters")
    private String site;

    @NotBlank(message = "Location is required")
    @Size(max = 255, message = "Location must not exceed 255 characters")
    private String location;

    @NotNull(message = "Program version is required")
    @Positive(message = "Program version ID must be greater than 0")
    private Long programVersionId;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    @NotNull(message = "End date is required")
    private LocalDate endDate;

    @NotNull(message = "Capacity is required")
    @Positive(message = "Capacity must be greater than 0")
    @Max(value = TrainingClassRules.MAX_CAPACITY, message = "Capacity must not exceed 50 trainees")
    @JsonDeserialize(using = ClassCapacityDeserializer.class)
    private Integer capacity;
}
