package com.example.starter_project_2025.system.project.aiassistant.provider;

public record LlmRequest(
        String systemInstruction,
        String userPrompt
) {
}
