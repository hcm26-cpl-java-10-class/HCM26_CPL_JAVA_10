package com.example.starter_project_2025.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

import java.util.Map;

/**
 * Spring Boot EnvironmentPostProcessor that injects variables from backend/.env into the
 * Spring Environment at startup.
 * <p>
 * Positioned right after 'systemEnvironment' so that OS environment variables (e.g. CI/CD or explicit
 * terminal variables) take precedence over the local .env file, while .env values take precedence
 * over application.properties defaults.
 */
public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    public static final String PROPERTY_SOURCE_NAME = "dotenvProperties";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Map<String, Object> dotenvMap = DotenvLoader.load();
        if (dotenvMap != null && !dotenvMap.isEmpty()) {
            MapPropertySource source = new MapPropertySource(PROPERTY_SOURCE_NAME, dotenvMap);
            if (environment.getPropertySources().contains(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME)) {
                environment.getPropertySources().addAfter(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME, source);
            } else {
                environment.getPropertySources().addLast(source);
            }
        }
    }

    @Override
    public int getOrder() {
        // Run before ConfigDataEnvironmentPostProcessor so properties in application.properties
        // can reference variables defined in .env via ${VAR:default}
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }
}
