package com.example.starter_project_2025.system.study_session;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class CancelSessionRequest {

    @NotBlank(message = "Cancellation reason is required")
    @Size(max = 500, message = "Cancellation reason must not exceed 500 characters")
    String reason;

    public void setReason(String reason) {
        this.reason = reason == null ? null : reason.trim();
    }
}
