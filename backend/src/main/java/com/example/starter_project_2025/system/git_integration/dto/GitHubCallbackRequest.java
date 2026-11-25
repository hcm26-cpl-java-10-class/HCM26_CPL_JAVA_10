package com.example.starter_project_2025.system.git_integration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Query parameters GitHub appended to the callback URL, forwarded as-is by the frontend.
 * The project is never taken from here: it comes from the server-side state.
 */
public record GitHubCallbackRequest(
        @NotBlank @Size(max = 128) String state,
        @Size(max = 256) String code,
        Long installationId,
        @Size(max = 20) String setupAction,
        @Size(max = 100) String error,
        @Size(max = 500) String errorDescription) {

    @Override
    public String toString() {
        return "GitHubCallbackRequest[installationId=" + installationId
                + ", setupAction=" + setupAction + ", error=" + error + "]";
    }
}
