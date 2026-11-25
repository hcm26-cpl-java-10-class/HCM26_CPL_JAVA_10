package com.example.starter_project_2025.system.project.aiassistant.service.generation;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.GeneratedTemplateOutput;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class TemplateOutputParser {

    private final ObjectMapper objectMapper;

    public TemplateOutputParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public GeneratedTemplateOutput parse(String generatedContent) {

        try {
            return objectMapper.readValue(
                    generatedContent,
                    GeneratedTemplateOutput.class
            );

        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException(
                    "AI generated an invalid Project Template JSON",
                    e
            );
        }
    }
}