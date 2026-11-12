package com.example.starter_project_2025.system.project.aiassistant.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.ai.template-assistant.gemini")
public class GeminiProperties {

    private String apiKey;

    private String model;

    private String baseUrl;

    private int timeoutSeconds;
}
