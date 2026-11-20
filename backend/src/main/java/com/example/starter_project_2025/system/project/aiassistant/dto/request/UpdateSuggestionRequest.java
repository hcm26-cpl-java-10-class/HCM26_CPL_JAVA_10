package com.example.starter_project_2025.system.project.aiassistant.dto.request;

import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.GeneratedTemplateOutput;
import jakarta.validation.constraints.NotNull;

public record UpdateSuggestionRequest(

        @NotNull
        GeneratedTemplateOutput output

) {}