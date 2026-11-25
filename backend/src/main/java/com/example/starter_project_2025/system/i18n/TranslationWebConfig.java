package com.example.starter_project_2025.system.i18n;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableConfigurationProperties(I18nProperties.class)
@RequiredArgsConstructor
public class TranslationWebConfig implements WebMvcConfigurer {

    private final TranslationRateLimitInterceptor translationRateLimitInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(translationRateLimitInterceptor)
                .addPathPatterns("/api/i18n/translate");
    }
}
