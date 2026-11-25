package com.example.starter_project_2025.system.trainer;

import jakarta.validation.constraints.*;
import java.util.Set;

public record CreateTrainerRequest(
    @NotBlank @Size(max = 50) @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9_-]{0,49}") String trainerCode,
    @NotBlank @Size(max = 150) String fullName,
    @NotBlank @Email @Size(max = 254) String email,
    @Size(max = 500) String specialization,
    @NotNull TrainerStatus status,
    @Size(max = 100) Set<@NotNull @Positive Long> teachingTopicIds
) {}
