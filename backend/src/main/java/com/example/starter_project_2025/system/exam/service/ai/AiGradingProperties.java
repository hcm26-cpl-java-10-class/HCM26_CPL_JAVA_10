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
    private boolean enabled = true;

    /**
     * API key for Google Gemini API (read from GEMINI_API_KEY).
     */
    private String apiKey;

    /**
     * Model name (e.g. gemini-3.5-flash-lite, gemini-2.5-flash).
     */
    private String model = "gemini-3.5-flash-lite";

    /**
     * Google Gemini API endpoint.
     */
    private String endpoint = "https://generativelanguage.googleapis.com/v1beta/models";

    /**
     * Request timeout in seconds.
     */
    private int timeoutSeconds = 45;
}
