package com.example.starter_project_2025.system.i18n;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
@EnableConfigurationProperties(I18nProperties.class)
public class TranslationConfig {

    /**
     * RestTemplate riêng cho tầng dịch tự động.
     *
     * <p>Tách riêng vì thời gian chờ của dịch vụ dịch khác với các API ngoài khác
     * (timeout chung trong {@code external.api.*} chỉ 10 giây).
     */
    @Bean("translationRestTemplate")
    public RestTemplate translationRestTemplate(
            RestTemplateBuilder builder,
            I18nProperties properties
    ) {
        return builder
                .setConnectTimeout(Duration.ofMillis(Math.min(properties.getTimeoutMs(), 5_000)))
                .setReadTimeout(Duration.ofMillis(properties.getTimeoutMs()))
                .build();
    }
}