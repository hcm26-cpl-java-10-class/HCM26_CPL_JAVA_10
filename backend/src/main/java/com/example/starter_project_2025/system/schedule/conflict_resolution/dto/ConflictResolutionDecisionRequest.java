package com.example.starter_project_2025.system.schedule.conflict_resolution.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ConflictResolutionDecisionRequest {

    @NotBlank
    @Size(max = 500)
    @Schema(description = "Mandatory reason for rejecting or revoking", example = "Facility approval was withdrawn")
    String reason;
}
