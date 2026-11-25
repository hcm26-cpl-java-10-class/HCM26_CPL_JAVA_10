package com.example.starter_project_2025.system.project.aiassistant.validator;

import com.example.starter_project_2025.system.project.aiassistant.dto.ResolvedReviewFindingTarget;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewTemplateNode;
import com.example.starter_project_2025.system.project.aiassistant.dto.request.review.ReviewFindingInput;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.ReviewSuggestionOutput;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingSeverity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReviewSuggestionOutputValidatorTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ReviewSuggestionOutputValidator validator = new ReviewSuggestionOutputValidator();
    private final ReviewFindingInput finding = new ReviewFindingInput(
            AIReviewFindingCategory.MODULE,
            AIReviewFindingSeverity.MEDIUM,
            "Improve module overview",
            "The module description is unclear",
            "Clarify the module description",
            "PROJECT_TEMPLATE",
            "42");
    private final ReviewTemplateNode module = new ReviewTemplateNode(
            42L, 7L, 1, "MOD-42", "Module", null, null, null,
            null, null, null, List.of(), List.of(), List.of(), List.of(), List.of());
    private final ResolvedReviewFindingTarget target = new ResolvedReviewFindingTarget(
            AIReviewFindingCategory.MODULE,
            "PROJECT_TEMPLATE",
            "42",
            42L,
            7L,
            module);

    @Test
    void acceptsTopLevelModuleOverviewChanges() throws Exception {
        JsonNode changes = objectMapper.readTree("""
                {"overview":{"description":"A clearer module description"}}
                """);

        assertTrue(validator.validate(
                new ReviewSuggestionOutput("Clarifies the module", changes),
                finding,
                target).isEmpty());
    }

    @Test
    void rejectsChangingModuleCategoryOrCreatingChildModules() throws Exception {
        JsonNode categoryChange = objectMapper.readTree("""
                {"overview":{"category":"NEW_CATEGORY"}}
                """);
        JsonNode childModule = objectMapper.readTree("""
                {"modules":[{"name":"New child"}]}
                """);

        assertFalse(validator.validate(
                new ReviewSuggestionOutput("Change category", categoryChange),
                finding,
                target).isEmpty());
        assertFalse(validator.validate(
                new ReviewSuggestionOutput("Create a child", childModule),
                finding,
                target).isEmpty());
    }

    @Test
    void rejectsNestedSystemManagedFields() throws Exception {
        JsonNode changes = objectMapper.readTree("""
                {"overview":{"description":"Updated","metadata":{"lockVersion":4}}}
                """);

        assertTrue(validator.validate(
                new ReviewSuggestionOutput("Update overview", changes),
                finding,
                target).stream().anyMatch(error -> error.contains("lockVersion")));
    }
}
