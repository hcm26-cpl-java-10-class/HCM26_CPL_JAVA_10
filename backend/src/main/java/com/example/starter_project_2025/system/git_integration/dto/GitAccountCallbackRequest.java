package com.example.starter_project_2025.system.git_integration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * GI-06: what GitHub appended to the callback URL after "Connect GitHub account", forwarded by
 * the frontend. The project comes from the server-side state, never from here.
 */
public record GitAccountCallbackRequest(
        @NotBlank @Size(max = 128) String state,
        @Size(max = 256) String code,
        @Size(max = 100) String error,
        @Size(max = 500) String errorDescription) {

    @Override
    public String toString() {
        return "GitAccountCallbackRequest[error=" + error + "]";
    }
}
