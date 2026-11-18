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

    private boolean enabled = true;

    private String apiKey;

    private String model = "gemini-3.5-flash-lite";

    private String endpoint = "https://generativelanguage.googleapis.com/v1beta/models";

    private int timeoutSeconds = 45;
}
