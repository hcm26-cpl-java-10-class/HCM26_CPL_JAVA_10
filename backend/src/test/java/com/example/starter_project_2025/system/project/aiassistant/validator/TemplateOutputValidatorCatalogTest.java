package com.example.starter_project_2025.system.project.aiassistant.validator;

import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.GeneratedTemplateOutput;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.ProjectTemplateOutput;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TemplateOutputValidatorCatalogTest {

    private final TemplateOutputValidator validator = new TemplateOutputValidator();

    @Test
    void rejectsUnavailableCategoryAndLevelWithActionableValidation() {
        GeneratedTemplateOutput output = output("Healthcare Management System", "Beginner");

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validate(output,
                        List.of("Web Application", "Capstone"),
                        List.of("BEGINNER", "INTERMEDIATE", "ADVANCED")));

        assertTrue(exception.getMessage().contains("Project category 'Healthcare Management System'"));
        assertTrue(exception.getMessage().contains("Web Application"));
        assertTrue(exception.getMessage().contains("Project level 'Beginner'"));
        assertTrue(exception.getMessage().contains("BEGINNER"));
    }

    @Test
    void doesNotReportCatalogErrorsForCategoryAndLevelThatMatchAvailableOptions() {
        GeneratedTemplateOutput output = output("Web Application", "ADVANCED");

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateForReview(output,
                        List.of("Web Application", "Capstone"),
                        List.of("BEGINNER", "INTERMEDIATE", "ADVANCED")));

        assertFalse(exception.getMessage().contains("Project category"));
        assertFalse(exception.getMessage().contains("Project level"));
    }

    private GeneratedTemplateOutput output(String category, String level) {
        return new GeneratedTemplateOutput(
                new ProjectTemplateOutput(
                        "CLINIC_APP", "Clinic App", "Clinic appointment system",
                        "Java", category, level, 8),
                null,
                null,
                null,
                null,
                null);
    }
}
