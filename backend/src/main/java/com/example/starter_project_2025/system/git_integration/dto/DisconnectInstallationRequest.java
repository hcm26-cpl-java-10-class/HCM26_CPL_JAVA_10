package com.example.starter_project_2025.system.git_integration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** GI-07 BR3: the account or organization name typed by the user to confirm the disconnection. */
public record DisconnectInstallationRequest(@NotBlank @Size(max = 100) String confirmLogin) {
}
