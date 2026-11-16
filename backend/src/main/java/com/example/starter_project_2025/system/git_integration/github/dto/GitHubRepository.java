package com.example.starter_project_2025.system.git_integration.github.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Repository as returned by GET /installation/repositories (only the fields the platform uses). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GitHubRepository(
        Long id,
        String name,
        @JsonProperty("full_name") String fullName,
        Owner owner,
        @JsonProperty("html_url") String htmlUrl,
        @JsonProperty("private") Boolean privateRepository,
        String visibility,
        @JsonProperty("default_branch") String defaultBranch,
        Boolean archived,
        Boolean disabled) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Owner(String login) {
    }

    public String ownerLogin() {
        return owner == null ? null : owner.login();
    }

    /** GitHub always sends {@code visibility} today; fall back to the private flag for older payloads. */
    public String resolvedVisibility() {
        if (visibility != null && !visibility.isBlank()) return visibility;
        return Boolean.TRUE.equals(privateRepository) ? "private" : "public";
    }
}
