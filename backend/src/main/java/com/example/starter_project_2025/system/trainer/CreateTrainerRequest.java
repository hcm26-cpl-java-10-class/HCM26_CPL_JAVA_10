package com.example.starter_project_2025.system.trainer;

import jakarta.validation.constraints.*;
import java.util.Set;

public record CreateTrainerRequest(
    @NotBlank @Size(max = Trainer.MAX_CODE_LENGTH) @Pattern(regexp = Trainer.CODE_REGEX) String trainerCode,
    @NotBlank @Size(max = Trainer.MAX_FULL_NAME_LENGTH) String fullName,
    @NotBlank @Email(regexp = Trainer.EMAIL_REGEX, message = "Work Email must be a valid email address.") @Size(max = Trainer.MAX_EMAIL_LENGTH) String email,
    @Size(max = Trainer.MAX_SPECIALIZATION_LENGTH) String specialization,
    @NotNull TrainerStatus status,
    @Size(max = 100) Set<@NotNull @Positive Long> teachingTopicIds
) {}
