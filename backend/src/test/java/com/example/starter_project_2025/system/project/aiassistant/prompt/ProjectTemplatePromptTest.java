package com.example.starter_project_2025.system.project.aiassistant.prompt;

import com.example.starter_project_2025.system.project.aiassistant.dto.request.GenerateTemplateRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjectTemplatePromptTest {

    private final ProjectTemplatePrompt prompt = new ProjectTemplatePrompt(new ObjectMapper());

    @Test
    void includesTenantAllowedCategoriesAndLevelsAsJsonValues() {
        String userPrompt = prompt.buildUserPrompt(
                new GenerateTemplateRequest("Clinic App", "Manage clinic appointments", "Web", null),
                List.of("Healthcare Management System", "Web Application"),
                List.of("BEGINNER", "ADVANCED"));

        assertTrue(userPrompt.contains("[\"Healthcare Management System\",\"Web Application\"]"));
        assertTrue(userPrompt.contains("[\"BEGINNER\",\"ADVANCED\"]"));
        assertTrue(userPrompt.contains("MUST exactly equal one value"));
    }
}
