package com.example.starter_project_2025.system.schedule_validation;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ScheduleValidationRequest {

    @NotEmpty(message = "At least one session is required")
    private List<@Valid SessionConflictCandidate> sessions;
}
