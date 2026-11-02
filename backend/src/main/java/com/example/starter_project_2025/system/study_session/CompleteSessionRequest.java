package com.example.starter_project_2025.system.study_session;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CompleteSessionRequest {

    @Size(max = 1000, message = "Notes must not exceed 1000 characters")
    private String notes;
}
