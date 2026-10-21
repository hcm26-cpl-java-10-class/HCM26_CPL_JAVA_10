package com.example.starter_project_2025.system.schedule.trainingclass.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RejectClassRevisionRequest extends ClassRevisionActionRequest {
    @NotBlank(message = "A rejection reason is required")
    @Size(max = 2000)
    private String reason;
}
