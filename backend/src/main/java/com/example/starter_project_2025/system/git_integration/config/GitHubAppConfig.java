package com.example.starter_project_2025.system.git_integration.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Clock;

@Configuration
@EnableConfigurationProperties(GitHubAppProperties.class)
public class GitHubAppConfig {

    /** Shared client for api.github.com; callers add the Authorization header per request. */
    @Bean
    public RestClient gitHubRestClient(GitHubAppProperties properties) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(properties.getConnectTimeoutMillis());
        requestFactory.setReadTimeout(properties.getReadTimeoutMillis());

        return RestClient.builder()
                .baseUrl(properties.getApiBaseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", properties.getApiVersion())
                .defaultHeader(HttpHeaders.USER_AGENT, "fams-git-integration")
                .build();
    }

    @Bean("gitIntegrationClock")
    public Clock gitIntegrationClock() {
        return Clock.systemDefaultZone();
    }
}
