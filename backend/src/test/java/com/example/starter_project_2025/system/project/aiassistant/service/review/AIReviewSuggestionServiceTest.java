package com.example.starter_project_2025.system.project.aiassistant.service.review;

import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewFinding;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewReport;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingStatus;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewSuggestionCapability;
import com.example.starter_project_2025.system.project.aiassistant.prompt.ReviewSuggestionPrompt;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmProvider;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewFindingRepository;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewReportRepository;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewSuggestionRepository;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewContextBuilder;
import com.example.starter_project_2025.system.project.aiassistant.service.generation.ReviewSuggestionOutputParser;
import com.example.starter_project_2025.system.project.aiassistant.validator.ReviewSuggestionOutputValidator;
import com.example.starter_project_2025.system.project.rubric.service.RubricCatalogService;
import com.example.starter_project_2025.system.project.template.service.ProjectTemplateAccessService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AIReviewSuggestionServiceTest {

    @Mock private AIReviewFindingRepository findings;
    @Mock private AIReviewReportRepository reports;
    @Mock private AIReviewSuggestionRepository suggestions;
    @Mock private ProjectTemplateReviewAccessService reviewAccess;
    @Mock private ProjectTemplateAccessService templateAccess;
    @Mock private ReviewContextBuilder contextBuilder;
    @Mock private ReviewFindingTargetResolver targetResolver;
    @Mock private ReviewSuggestionPrompt prompt;
    @Mock private LlmProvider llmProvider;
    @Mock private ReviewSuggestionOutputParser outputParser;
    @Mock private ReviewSuggestionOutputValidator outputValidator;
    @Mock private RubricCatalogService rubricCatalog;
    @Mock private ObjectMapper objectMapper;

    @InjectMocks
    private AIReviewSuggestionService service;

    @Test
    void rejectsManualRequiredFindingBeforeCallingSuggestionModel() {
        assertGenerationBlocked(AIReviewSuggestionCapability.MANUAL_REQUIRED);
    }

    @Test
    void rejectsUnclassifiedLegacyFindingBeforeCallingSuggestionModel() {
        assertGenerationBlocked(null);
    }

    private void assertGenerationBlocked(AIReviewSuggestionCapability capability) {
        AIReviewFinding finding = AIReviewFinding.builder()
                .status(AIReviewFindingStatus.OPEN)
                .suggestionCapability(capability)
                .suggestionCapabilityReason(capability == null
                        ? null
                        : "Create multiple milestones, which is unsupported.")
                .build();
        when(reports.findByIdAndProjectTemplate_Id(2L, 1L))
                .thenReturn(Optional.of(mock(AIReviewReport.class)));
        when(findings.findByIdAndReport_Id(3L, 2L)).thenReturn(Optional.of(finding));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.generate(1L, 2L, 3L));

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, exception.getStatusCode());
        if (capability == null) {
            assertTrue(exception.getReason().contains("predates"));
        }
        verifyNoInteractions(contextBuilder, targetResolver, prompt, llmProvider, outputParser,
                outputValidator, suggestions, rubricCatalog, templateAccess, objectMapper);
    }
}
