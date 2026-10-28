
package com.example.trainingprogram.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CloneProgramRequest(
    @NotBlank(message = "New version is required.")
    @Size(max = 40, message = "New version must not exceed 40 characters.")
    String newVersion
) {}
