package com.example.starter_project_2025.system.project.aiassistant.service.generation;

import com.example.starter_project_2025.system.project.aiassistant.dto.request.GenerateTemplateRequest;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.GeneratedTemplateOutput;
import com.example.starter_project_2025.system.project.aiassistant.prompt.ProjectTemplatePrompt;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmProvider;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmRequest;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmResponse;
import com.example.starter_project_2025.system.project.aiassistant.validator.TemplateOutputValidator;
import org.springframework.stereotype.Service;

@Service
public class TemplateGenerationService {

    private final LlmProvider llmProvider;
    private final ProjectTemplatePrompt projectTemplatePrompt;
    private final TemplateOutputParser templateOutputParser;
    private final TemplateOutputValidator templateOutputValidator;

    public TemplateGenerationService(
            LlmProvider llmProvider,
            ProjectTemplatePrompt projectTemplatePrompt,
            TemplateOutputParser templateOutputParser,
            TemplateOutputValidator templateOutputValidator
    ) {
        this.llmProvider = llmProvider;
        this.projectTemplatePrompt = projectTemplatePrompt;
        this.templateOutputParser = templateOutputParser;
        this.templateOutputValidator = templateOutputValidator;
    }

    public TemplateGenerationResult generate(GenerateTemplateRequest request) {

        // 1. Build prompt
        String systemInstruction =
                projectTemplatePrompt.buildSystemInstruction();

        String userPrompt =
                projectTemplatePrompt.buildUserPrompt(request);

        // 2. Create LLM request
        LlmRequest llmRequest =
                new LlmRequest(systemInstruction, userPrompt);

        // 3. Call Gemini
        LlmResponse llmResponse =
                llmProvider.generate(llmRequest);

        // 4. Parse original JSON into Java object
        GeneratedTemplateOutput output =
                templateOutputParser.parse(llmResponse.content());

        // 5. Validate generated data
        templateOutputValidator.validate(output);

        // 6. Return both parsed output and original AI response
        return new TemplateGenerationResult(
                output,
                llmResponse.content(),
                llmResponse.model()
        );
    }
}