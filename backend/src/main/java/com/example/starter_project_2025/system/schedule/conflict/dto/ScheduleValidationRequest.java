package com.example.starter_project_2025.system.schedule.conflict.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ScheduleValidationRequest {

    @NotEmpty(message = "Provide at least one session to validate.")
    @Size(max = 100, message = "A validation request cannot contain more than 100 sessions.")
    List<@jakarta.validation.constraints.NotNull(message = "Session details are required.") @Valid SessionCandidateRequest> sessions;
}
