package com.example.starter_project_2025.system.git_integration.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.security.interfaces.RSAPrivateKey;
import java.util.List;

/**
 * Validates GitHub App settings at startup and keeps the private key in memory
 * only. The key is never persisted, logged, or exposed through any API.
 */
@Slf4j
@Component
public class GitHubAppCredentials {

    private final GitHubAppProperties properties;
    private final RSAPrivateKey privateKey;

    public GitHubAppCredentials(GitHubAppProperties properties) {
        this.properties = properties;
        if (!properties.isEnabled()) {
            this.privateKey = null;
            log.info("GitHub App integration is disabled (app.github.enabled=false)");
            return;
        }
        List<String> missing = properties.missingRequiredSettings();
        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "GitHub App integration is enabled but misconfigured: " + String.join(", ", missing));
        }
        this.privateKey = GitHubPrivateKeyLoader.load(properties);
        log.info("GitHub App integration enabled for app id {} ({})",
                properties.getAppId(), properties.getAppSlug());
    }

    public boolean isEnabled() {
        return properties.isEnabled();
    }

    public RSAPrivateKey privateKey() {
        requireEnabled();
        return privateKey;
    }

    public void requireEnabled() {
        if (!properties.isEnabled()) {
            throw new IllegalStateException("GitHub App integration is disabled");
        }
    }
}
