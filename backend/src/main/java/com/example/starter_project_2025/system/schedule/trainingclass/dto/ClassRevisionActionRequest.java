package com.example.starter_project_2025.system.schedule.trainingclass.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ClassRevisionActionRequest {
    @NotNull(message = "Class version is required")
    @PositiveOrZero
    private Long version;
    @NotNull(message = "Revision version is required")
    @PositiveOrZero
    private Long revisionVersion;
}
