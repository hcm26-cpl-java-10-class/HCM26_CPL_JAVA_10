package com.example.starter_project_2025.system.exam.service.ai;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "app.ai")
@Getter
@Setter
public class AiGradingProperties {

    /**
     * Whether AI-assisted grading is enabled.
     */
    private boolean enabled = false;

    /**
     * API key for the AI provider (e.g. OpenAI / Gemini-compatible endpoint).
     */
    private String apiKey;

    /**
     * Model name (e.g. gpt-4o-mini, gpt-4o, gemini-1.5-flash).
     */
    private String model = "gpt-4o-mini";

    /**
     * Chat completions API endpoint.
     */
    private String endpoint = "https://api.openai.com/v1/chat/completions";

    /**
     * Request timeout in seconds.
     */
    private int timeoutSeconds = 30;
}
